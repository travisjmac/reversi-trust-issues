"use strict";

/**
 * Reversi: Othello with Trust Issues
 * Standard 8×8 reversi. No dependencies.
 * Black opens. A move must outflank at least one opponent disc in a straight
 * line; every outflanked disc flips. No legal move passes on its own.
 * The game ends when neither side can move. Most discs wins. Ties stand.
 */
(function (global) {
  var SIZE = 8;
  var EMPTY = 0;
  var BLACK = 1;
  var WHITE = 2;
  var DIRS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ];
  var WEIGHTS = [
    [100, -25, 10, 5, 5, 10, -25, 100],
    [-25, -45, -5, -5, -5, -5, -45, -25],
    [10, -5, 8, 2, 2, 8, -5, 10],
    [5, -5, 2, 1, 1, 2, -5, 5],
    [5, -5, 2, 1, 1, 2, -5, 5],
    [10, -5, 8, 2, 2, 8, -5, 10],
    [-25, -45, -5, -5, -5, -5, -45, -25],
    [100, -25, 10, 5, 5, 10, -25, 100]
  ];

  function other(player) {
    return player === BLACK ? WHITE : BLACK;
  }

  function alg(r, c) {
    return "abcdefgh"[c] + String(r + 1);
  }

  function opening() {
    var board = [];
    var r;
    for (r = 0; r < SIZE; r++) board.push([0, 0, 0, 0, 0, 0, 0, 0]);
    board[3][3] = WHITE;
    board[3][4] = BLACK;
    board[4][3] = BLACK;
    board[4][4] = WHITE;
    return board;
  }

  function flipsFor(board, r, c, player) {
    if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return [];
    if (board[r][c] !== EMPTY) return [];
    var opp = other(player);
    var flipped = [];
    var d, dr, dc, rr, cc, line, i;
    for (d = 0; d < DIRS.length; d++) {
      dr = DIRS[d][0];
      dc = DIRS[d][1];
      line = [];
      rr = r + dr;
      cc = c + dc;
      while (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE && board[rr][cc] === opp) {
        line.push([rr, cc]);
        rr += dr;
        cc += dc;
      }
      if (line.length && rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE && board[rr][cc] === player) {
        for (i = 0; i < line.length; i++) flipped.push(line[i]);
      }
    }
    return flipped;
  }

  function legalMoves(board, player) {
    var moves = [];
    var r, c;
    for (r = 0; r < SIZE; r++) {
      for (c = 0; c < SIZE; c++) {
        if (flipsFor(board, r, c, player).length) moves.push({ r: r, c: c });
      }
    }
    return moves;
  }

  function applyMove(board, r, c, player) {
    var gained = flipsFor(board, r, c, player);
    if (!gained.length) return null;
    var next = board.map(function (row) { return row.slice(); });
    var i;
    next[r][c] = player;
    for (i = 0; i < gained.length; i++) next[gained[i][0]][gained[i][1]] = player;
    return { board: next, flipped: gained };
  }

  function counts(board) {
    var black = 0;
    var white = 0;
    var r, c, v;
    for (r = 0; r < SIZE; r++) {
      for (c = 0; c < SIZE; c++) {
        v = board[r][c];
        if (v === BLACK) black += 1;
        else if (v === WHITE) white += 1;
      }
    }
    return { black: black, white: white };
  }

  function outcome(board) {
    if (legalMoves(board, BLACK).length || legalMoves(board, WHITE).length) return null;
    var tally = counts(board);
    var winner = "tie";
    if (tally.black > tally.white) winner = "black";
    else if (tally.white > tally.black) winner = "white";
    return { winner: winner, black: tally.black, white: tally.white };
  }

  function evaluate(board, player) {
    var opp = other(player);
    var score = 0;
    var r, c;
    for (r = 0; r < SIZE; r++) {
      for (c = 0; c < SIZE; c++) {
        if (board[r][c] === player) score += WEIGHTS[r][c];
        else if (board[r][c] === opp) score -= WEIGHTS[r][c];
      }
    }
    score += (legalMoves(board, player).length - legalMoves(board, opp).length) * 5;
    return score;
  }

  function rankMoves(board, player) {
    return legalMoves(board, player).map(function (move) {
      var applied = applyMove(board, move.r, move.c, player);
      return { m: move, s: applied ? evaluate(applied.board, player) : -99999 };
    }).sort(function (a, b) {
      return (b.s - a.s) || (a.m.r - b.m.r) || (a.m.c - b.m.c);
    });
  }

  function aiChoose(board, player) {
    var ranked = rankMoves(board, player);
    var rest, limit;
    if (!ranked.length) return null;
    if (ranked.length > 1 && Math.random() < 0.34) {
      rest = ranked.slice(1);
      limit = Math.max(1, Math.ceil(rest.length * 0.5));
      return rest[Math.floor(Math.random() * limit)].m;
    }
    return ranked[0].m;
  }

  function mount(el) {
    if (!el) throw new Error("Reversi needs an element to mount in.");

    var mode = "solo";
    var board = opening();
    var turn = BLACK;
    var cursor = { r: 2, c: 3 };
    var phase = "play";
    var lastMove = null;
    var hintCell = null;
    var just = new Set();
    var hist = [];
    var aside = "";
    var timer = 0;
    var dead = false;

    el.textContent = "";

    var style = document.createElement("style");
    style.textContent = cssText();
    el.appendChild(style);

    var root = document.createElement("div");
    root.className = "rti";
    root.tabIndex = 0;
    root.setAttribute("aria-label", "Reversi: Othello with Trust Issues");
    root.innerHTML = shellHtml();
    el.appendChild(root);

    var boardEl = root.querySelector(".rti-board");
    var cells = [];
    var r, c, cell, disc;
    for (r = 0; r < SIZE; r++) {
      for (c = 0; c < SIZE; c++) {
        cell = document.createElement("div");
        cell.className = "rti-cell";
        cell.setAttribute("role", "gridcell");
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        if ((r + c) % 2 === 0) cell.classList.add("is-shade");
        cell.innerHTML = peekMarkup() + discMarkup();
        disc = cell.querySelector(".rti-disc");
        boardEl.appendChild(cell);
        cells.push({ r: r, c: c, cell: cell, disc: disc });
      }
    }

    var soloBtn = root.querySelector('[data-mode="solo"]');
    var hotBtn = root.querySelector('[data-mode="hotseat"]');
    var turnEl = root.querySelector(".rti-turn");
    var asideEl = root.querySelector(".rti-aside");
    var cursorEl = root.querySelector(".rti-cursor");
    var overlay = root.querySelector(".rti-overlay");
    var overlayTitle = overlay.querySelector("h2");
    var overlayBody = overlay.querySelector("p");
    var scoreEl = root.querySelector(".rti-score");
    var blackSide = root.querySelector('[data-side="black"]');
    var whiteSide = root.querySelector('[data-side="white"]');
    var blackCountEl = root.querySelector('[data-count="black"]');
    var whiteCountEl = root.querySelector('[data-count="white"]');
    var blackRole = root.querySelector('[data-role="black"]');
    var whiteRole = root.querySelector('[data-role="white"]');
    var hintBtn = root.querySelector('[data-act="hint"]');
    var undoBtn = root.querySelector('[data-act="undo"]');
    var passBtn = root.querySelector('[data-act="pass"]');
    var restartBtn = root.querySelector('[data-act="restart"]');

    function sideName(player) {
      if (player === BLACK) return mode === "solo" ? "Black, you" : "Black";
      return mode === "solo" ? "White, AI" : "White";
    }

    function later(fn, ms) {
      clearTimeout(timer);
      timer = setTimeout(function () {
        timer = 0;
        if (!dead) fn();
      }, ms);
    }

    function cancelTimer() {
      clearTimeout(timer);
      timer = 0;
    }

    function pushHist(plyKind) {
      hist.push({
        board: board.map(function (row) { return row.slice(); }),
        turn: turn,
        cursor: { r: cursor.r, c: cursor.c },
        lastMove: lastMove ? { r: lastMove.r, c: lastMove.c } : null,
        plyKind: plyKind,
        actor: turn
      });
      if (hist.length > 120) hist.shift();
    }

    function statusText() {
      var tally = counts(board);
      if (phase === "stopped") return "Stopped";
      if (phase === "over") {
        if (tally.black === tally.white) return "Tie " + tally.black + "–" + tally.white;
        if (tally.black > tally.white) return "Black wins " + tally.black + "–" + tally.white;
        return "White wins " + tally.white + "–" + tally.black;
      }
      var n = legalMoves(board, turn).length;
      var name = sideName(turn);
      if (n === 0) return name + " · no legal move";
      return name + " to move · " + n + " legal";
    }

    function render() {
      var tally = counts(board);
      var moveList = legalMoves(board, turn);
      var legal = new Set();
      var i, item, owner, key, isCursor, isHint, isLegal, isLast;
      for (i = 0; i < moveList.length; i++) {
        if (phase !== "over") legal.add(moveList[i].r + "," + moveList[i].c);
      }
      for (i = 0; i < cells.length; i++) {
        item = cells[i];
        key = item.r + "," + item.c;
        owner = board[item.r][item.c] === BLACK ? "black" : board[item.r][item.c] === WHITE ? "white" : "empty";
        isCursor = cursor.r === item.r && cursor.c === item.c;
        isHint = !!(hintCell && hintCell.r === item.r && hintCell.c === item.c);
        isLegal = legal.has(key);
        isLast = !!(lastMove && lastMove.r === item.r && lastMove.c === item.c);
        item.cell.classList.toggle("is-cursor", isCursor);
        item.cell.classList.toggle("is-hint", isHint);
        item.cell.classList.toggle("is-legal", isLegal);
        item.cell.dataset.owner = owner;
        item.cell.dataset.legal = isLegal ? "1" : "0";
        item.cell.dataset.cursor = isCursor ? "1" : "0";
        item.cell.dataset.hint = isHint ? "1" : "0";
        item.cell.setAttribute("aria-label", alg(item.r, item.c) + " " + owner + (isLegal ? " legal" : ""));
        item.disc.classList.toggle("is-on", owner !== "empty");
        item.disc.classList.toggle("is-black", owner === "black");
        item.disc.classList.toggle("is-white", owner === "white");
        item.disc.classList.toggle("is-last", isLast && owner !== "empty");
        item.disc.classList.toggle("is-new", just.has(key) && owner !== "empty");
      }
      blackCountEl.textContent = String(tally.black);
      whiteCountEl.textContent = String(tally.white);
      blackRole.textContent = mode === "solo" ? "You" : "Human";
      whiteRole.textContent = mode === "solo" ? "AI" : "Human";
      blackSide.classList.toggle("is-active", phase === "play" && turn === BLACK);
      whiteSide.classList.toggle("is-active", phase === "play" && turn === WHITE);
      scoreEl.classList.toggle("is-play", phase === "play");
      turnEl.textContent = statusText();
      asideEl.textContent = aside;
      var cursorLine = "Cursor " + alg(cursor.r, cursor.c);
      if (phase === "play" && !(mode === "solo" && turn === WHITE)) {
        cursorLine += flipsFor(board, cursor.r, cursor.c, turn).length ? " · legal" : " · does not outflank";
      }
      cursorEl.textContent = cursorLine;
      soloBtn.setAttribute("aria-pressed", mode === "solo" ? "true" : "false");
      hotBtn.setAttribute("aria-pressed", mode === "hotseat" ? "true" : "false");
      passBtn.disabled = !(phase === "play" && moveList.length === 0 && !(mode === "solo" && turn === WHITE));
      undoBtn.disabled = phase === "stopped" || hist.length === 0;
      if (phase === "stopped" || phase === "over") {
        overlay.hidden = false;
        if (phase === "stopped") {
          overlayTitle.textContent = "Stopped";
          overlayBody.textContent = "Quit. The board is frozen. R starts a new game.";
        } else {
          overlayTitle.textContent = statusText();
          var empty = SIZE * SIZE - tally.black - tally.white;
          overlayBody.textContent = empty
            ? empty + " squares stay empty because neither side can move. U takes a move back. R restarts."
            : "The board is full. U takes a move back. R restarts.";
        }
      } else {
        overlay.hidden = true;
      }
      root.dataset.phase = phase;
      root.dataset.turn = turn === BLACK ? "black" : "white";
      root.dataset.mode = mode;
      root.dataset.black = String(tally.black);
      root.dataset.white = String(tally.white);
      root.dataset.cursor = alg(cursor.r, cursor.c);
      if (hintCell) root.dataset.hint = alg(hintCell.r, hintCell.c);
      else delete root.dataset.hint;
    }

    function beginTurn() {
      if (dead || phase !== "play") return;
      hintCell = null;
      if (!legalMoves(board, BLACK).length && !legalMoves(board, WHITE).length) {
        finish();
        return;
      }
      if (!legalMoves(board, turn).length) {
        var who = turn;
        aside = (who === BLACK ? "Black" : "White") + " cannot outflank a disc, so the turn passes.";
        render();
        later(function () {
          if (phase !== "play" || turn !== who) return;
          doPass();
        }, 780);
        return;
      }
      if (mode === "solo" && turn === WHITE) {
        render();
        later(function () {
          if (phase !== "play" || turn !== WHITE || mode !== "solo") return;
          var choice = aiChoose(board, WHITE);
          if (!choice) doPass();
          else commitMove(choice.r, choice.c, true);
        }, 450);
        return;
      }
      render();
    }

    function finish() {
      cancelTimer();
      phase = "over";
      var tally = counts(board);
      var empty = SIZE * SIZE - tally.black - tally.white;
      if (tally.black === tally.white) aside = "Tie. The counts match, and neither side can move.";
      else if (tally.black > tally.white) aside = "Black has the most discs.";
      else aside = "White has the most discs.";
      if (empty) aside += " Empty squares stay empty.";
      render();
    }

    function commitMove(r0, c0, fromAi) {
      if (dead || phase !== "play") return;
      if (fromAi) {
        if (turn !== WHITE) return;
      } else if (mode === "solo" && turn !== BLACK) {
        aside = "White is still choosing.";
        render();
        return;
      }
      var applied = applyMove(board, r0, c0, turn);
      if (!applied) {
        aside = "No outflank from " + alg(r0, c0) + ". A move has to trap a straight line.";
        cursor = { r: r0, c: c0 };
        render();
        return;
      }
      cancelTimer();
      pushHist("place");
      var who = turn;
      var i;
      board = applied.board;
      just = new Set();
      just.add(r0 + "," + c0);
      for (i = 0; i < applied.flipped.length; i++) just.add(applied.flipped[i][0] + "," + applied.flipped[i][1]);
      lastMove = { r: r0, c: c0 };
      cursor = { r: r0, c: c0 };
      turn = other(who);
      hintCell = null;
      var corner = (r0 === 0 || r0 === SIZE - 1) && (c0 === 0 || c0 === SIZE - 1);
      aside = (corner ? "Corner " : "") + alg(r0, c0) + " flips " + applied.flipped.length + ".";
      if (mode === "hotseat") aside += " Pass the keyboard to " + (turn === BLACK ? "Black" : "White") + ".";
      else if (who === WHITE) aside += " White stands by it.";
      beginTurn();
    }

    function tryPlace() {
      if (phase !== "play") return;
      if (mode === "solo" && turn !== BLACK) {
        aside = "White is still choosing.";
        render();
        return;
      }
      if (!legalMoves(board, turn).length) {
        aside = "No legal move. P passes now, or wait for the automatic pass.";
        render();
        return;
      }
      commitMove(cursor.r, cursor.c, false);
    }

    function doPass() {
      if (dead || phase !== "play") return;
      if (legalMoves(board, turn).length) {
        aside = "Pass is only available when the side to move has no legal move.";
        render();
        return;
      }
      if (!legalMoves(board, other(turn)).length) {
        finish();
        return;
      }
      cancelTimer();
      pushHist("pass");
      var who = turn;
      turn = other(turn);
      aside = (who === BLACK ? "Black" : "White") + " passes.";
      if (mode === "hotseat") aside += " Pass the keyboard to " + (turn === BLACK ? "Black" : "White") + ".";
      beginTurn();
    }

    function restore(snap) {
      board = snap.board.map(function (row) { return row.slice(); });
      turn = snap.turn;
      cursor = { r: snap.cursor.r, c: snap.cursor.c };
      phase = "play";
      lastMove = snap.lastMove ? { r: snap.lastMove.r, c: snap.lastMove.c } : null;
      hintCell = null;
      just = new Set();
      aside = "Undone. The board will pretend that did not happen.";
      beginTurn();
    }

    function undo() {
      if (dead || phase === "stopped") return;
      if (!hist.length) {
        aside = "Nothing to take back.";
        render();
        return;
      }
      cancelTimer();
      var snap;
      if (mode === "solo") {
        while (hist.length) {
          snap = hist.pop();
          if (snap.actor === BLACK && snap.plyKind === "place") break;
        }
      } else {
        snap = hist.pop();
        if (snap.plyKind === "pass" && hist.length) snap = hist.pop();
      }
      restore(snap);
    }

    function showHint() {
      if (phase === "stopped") return;
      if (phase !== "play") {
        aside = "The game is over. R restarts.";
        render();
        return;
      }
      if (mode === "solo" && turn !== BLACK) {
        aside = "Hint is for your turn.";
        render();
        return;
      }
      var ranked = rankMoves(board, turn);
      if (!ranked.length) {
        aside = "No legal move to hint.";
        render();
        return;
      }
      var best = ranked[0].m;
      hintCell = { r: best.r, c: best.c };
      cursor = { r: best.r, c: best.c };
      aside = "Hint " + alg(best.r, best.c) + ". It outflanks " + flipsFor(board, best.r, best.c, turn).length + ".";
      render();
    }

    function quit() {
      if (dead || phase === "stopped") return;
      cancelTimer();
      phase = "stopped";
      aside = "Quit. Nothing else will be placed until you restart.";
      render();
    }

    function restart(message) {
      if (dead) return;
      cancelTimer();
      hist = [];
      board = opening();
      turn = BLACK;
      cursor = { r: 2, c: 3 };
      phase = "play";
      lastMove = null;
      hintCell = null;
      just = new Set();
      if (typeof message === "string") aside = message;
      else if (mode === "solo") aside = "New game. You are black. White is beatable.";
      else aside = "New game. Black first. Share the keyboard.";
      beginTurn();
    }

    function moveCursor(key) {
      var nr = cursor.r;
      var nc = cursor.c;
      if (key === "ArrowUp") nr -= 1;
      else if (key === "ArrowDown") nr += 1;
      else if (key === "ArrowLeft") nc -= 1;
      else if (key === "ArrowRight") nc += 1;
      cursor = {
        r: Math.max(0, Math.min(SIZE - 1, nr)),
        c: Math.max(0, Math.min(SIZE - 1, nc))
      };
      render();
    }

    function onKey(e) {
      var key, onButton;
      if (dead) return;
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      key = e.key;
      onButton = !!(e.target && e.target.closest && e.target.closest("button"));
      if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight") {
        e.preventDefault();
        if (phase === "play") moveCursor(key);
        return;
      }
      if (e.repeat) return;
      if ((key === "Enter" || key === " ") && onButton) return;
      if (key === "Enter" || key === " ") {
        e.preventDefault();
        if (phase === "play") tryPlace();
        return;
      }
      if (key === "Escape") {
        e.preventDefault();
        quit();
        return;
      }
      if (key === "r" || key === "R") {
        restart();
        return;
      }
      if (phase !== "play") return;
      if (key === "h" || key === "H") showHint();
      else if (key === "u" || key === "U") undo();
      else if (key === "p" || key === "P") doPass();
    }

    cells.forEach(function (item) {
      item.cell.addEventListener("click", function () {
        if (phase !== "play") return;
        cursor = { r: item.r, c: item.c };
        tryPlace();
        root.focus({ preventScroll: true });
      });
    });
    soloBtn.addEventListener("click", function () {
      if (mode !== "solo") {
        mode = "solo";
        restart("Solo game. You are black. White is beatable.");
      }
      root.focus({ preventScroll: true });
    });
    hotBtn.addEventListener("click", function () {
      if (mode !== "hotseat") {
        mode = "hotseat";
        restart("Two humans, one keyboard. Black moves first.");
      }
      root.focus({ preventScroll: true });
    });
    hintBtn.addEventListener("click", function () { showHint(); root.focus({ preventScroll: true }); });
    undoBtn.addEventListener("click", function () { undo(); root.focus({ preventScroll: true }); });
    passBtn.addEventListener("click", function () { doPass(); root.focus({ preventScroll: true }); });
    restartBtn.addEventListener("click", function () { restart(); root.focus({ preventScroll: true }); });
    window.addEventListener("keydown", onKey);

    restart();
    root.focus({ preventScroll: true });

    return {
      destroy: function () {
        if (dead) return;
        dead = true;
        cancelTimer();
        window.removeEventListener("keydown", onKey);
        el.textContent = "";
      }
    };
  }

  var sceneSerial = 0;

  function peekMarkup() {
    return '<svg class="rti-peek" viewBox="0 0 44 18" aria-hidden="true">' +
      '<path d="M2 11 Q11 2 20 11 Q11 16 2 11z" fill="#f4ead8"/>' +
      '<path d="M24 11 Q33 2 42 11 Q33 16 24 11z" fill="#f4ead8"/>' +
      '<circle cx="11" cy="11" r="2.1" fill="#1b120c"/>' +
      '<circle cx="33" cy="11" r="2.1" fill="#1b120c"/>' +
      "</svg>";
  }

  function discMarkup() {
    return '<svg class="rti-disc" viewBox="0 0 80 80" aria-hidden="true">' +
      '<g class="face face-black">' +
      '<circle cx="40" cy="43" r="33" fill="#070707"/>' +
      '<circle cx="40" cy="39" r="31" fill="#2a2a2a"/>' +
      '<path d="M24 24c8-8 24-8 34 0" fill="none" stroke="#5c5c5c" stroke-width="3" stroke-linecap="round" opacity="0.7"/>' +
      '<ellipse cx="28" cy="38" rx="8" ry="9" fill="#f7f1e6"/>' +
      '<ellipse cx="52" cy="38" rx="8" ry="9" fill="#f7f1e6"/>' +
      '<circle cx="31" cy="39" r="3.4" fill="#1a120c"/>' +
      '<circle cx="55" cy="39" r="3.4" fill="#1a120c"/>' +
      '<path d="M19 28q8-8 16 1" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M44 30q8-5 16 2" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M28 54q12 8 26-3" fill="none" stroke="#e4d2b4" stroke-width="3" stroke-linecap="round"/>' +
      '<path class="sweat" d="M63 18c4 5 3 10-1 12-3-3-3-8 1-12z" fill="#9fd7ff"/>' +
      "</g>" +
      '<g class="face face-white">' +
      '<circle cx="40" cy="43" r="33" fill="#c9bba6"/>' +
      '<circle cx="40" cy="39" r="31" fill="#fff8ee"/>' +
      '<path d="M24 22c8-7 22-7 32 1" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
      '<ellipse cx="28" cy="38" rx="8" ry="9.5" fill="#fff"/>' +
      '<ellipse cx="52" cy="38" rx="8" ry="9.5" fill="#fff"/>' +
      '<circle cx="25" cy="40" r="3.4" fill="#2a2118"/>' +
      '<circle cx="49" cy="40" r="3.4" fill="#2a2118"/>' +
      '<path d="M19 29q8-6 16 2" fill="none" stroke="#8a6a48" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M45 30q8-7 17 1" fill="none" stroke="#8a6a48" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M30 56q10-8 22 1" fill="none" stroke="#d07a74" stroke-width="3" stroke-linecap="round"/>' +
      '<ellipse cx="16" cy="50" rx="5" ry="3" fill="#f0a0a0" opacity="0.7"/>' +
      '<ellipse cx="64" cy="50" rx="5" ry="3" fill="#f0a0a0" opacity="0.7"/>' +
      '<path class="sweat" d="M64 16c4 5 3 10-1 12-3-3-3-8 1-12z" fill="#7ec8e8"/>' +
      "</g></svg>";
  }

  function pipFace(kind) {
    if (kind === "black") {
      return '<svg class="rti-pip" viewBox="0 0 32 32" aria-hidden="true">' +
        '<circle cx="16" cy="17" r="13" fill="#111"/>' +
        '<circle cx="16" cy="15.5" r="12" fill="#2c2c2c"/>' +
        '<ellipse cx="11" cy="15" rx="3.2" ry="3.6" fill="#f7f1e6"/>' +
        '<ellipse cx="20" cy="15" rx="3.2" ry="3.6" fill="#f7f1e6"/>' +
        '<circle cx="12.3" cy="15.6" r="1.4" fill="#1a120c"/>' +
        '<circle cx="21.3" cy="15.6" r="1.4" fill="#1a120c"/>' +
        '<path d="M11 22q5 3 10-1" fill="none" stroke="#e4d2b4" stroke-width="1.4" stroke-linecap="round"/>' +
        "</svg>";
    }
    return '<svg class="rti-pip" viewBox="0 0 32 32" aria-hidden="true">' +
      '<circle cx="16" cy="17" r="13" fill="#d9cbb8"/>' +
      '<circle cx="16" cy="15.5" r="12" fill="#fff8ee"/>' +
      '<ellipse cx="11" cy="15" rx="3.2" ry="3.6" fill="#fff"/>' +
      '<ellipse cx="20" cy="15" rx="3.2" ry="3.6" fill="#fff"/>' +
      '<circle cx="10" cy="16" r="1.4" fill="#2a2118"/>' +
      '<circle cx="19" cy="16" r="1.4" fill="#2a2118"/>' +
      '<path d="M11 22q5-3 10 1" fill="none" stroke="#d07a74" stroke-width="1.4" stroke-linecap="round"/>' +
      "</svg>";
  }

  function cssText() {
    return [
      ".rti{position:relative;box-sizing:border-box;width:100%;height:100%;min-height:100%;overflow:auto;color:#f6f0e4;",
      "background:#1a120e;font:16px/1.4 system-ui,Segoe UI,sans-serif;display:flex;justify-content:center;",
      "padding:10px 16px 14px;user-select:none;-webkit-user-select:none;}",
      ".rti,.rti *{box-sizing:border-box;}",
      ".rti:focus{outline:none;}",
      ".rti-wallpaper{position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;}",
      ".rti-shell{position:relative;z-index:1;width:min(680px,100%);display:flex;flex-direction:column;align-items:stretch;gap:7px;}",
      ".rti-head{text-align:center;}",
      ".rti-mascot{width:min(168px,42vw);height:auto;display:block;margin:0 auto 2px;}",
      ".rti h1{margin:0;font-family:Georgia,'Iowan Old Style',Palatino,serif;font-size:clamp(1.28rem,2.4vw,1.8rem);",
      "font-weight:700;letter-spacing:-.02em;line-height:1.12;}",
      ".rti-rule{margin:4px auto 0;max-width:40rem;color:#e6d3b4;font-size:.92rem;}",
      ".rti-modes,.rti-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;}",
      ".rti button{font:inherit;font-size:.9rem;color:#f6f0e4;cursor:pointer;border-radius:999px;padding:6px 12px;",
      "background:linear-gradient(#5a3d28,#2a1c14);border:2px solid #e0b45a;box-shadow:0 2px 0 #140e0a;}",
      ".rti button:hover:not(:disabled){border-color:#ffe0a0;}",
      ".rti button:focus-visible{outline:2px solid #f0d7a2;outline-offset:2px;}",
      ".rti button[aria-pressed=true]{background:linear-gradient(#f6d56a,#d0891c);color:#1a1208;border-color:#ffe7a8;font-weight:700;}",
      ".rti button:disabled{opacity:.4;cursor:not-allowed;}",
      ".rti-score{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;width:100%;}",
      ".rti-side.is-active .rti-count{color:#f0b429;}",
      ".rti-score.is-play .rti-side:not(.is-active){opacity:.78;}",
      ".rti-name{display:flex;align-items:center;gap:6px;font-weight:700;}",
      ".rti-side[data-side=white]{text-align:right;}",
      ".rti-side[data-side=white] .rti-name{justify-content:flex-end;}",
      ".rti-count{display:block;margin-top:1px;font-family:Georgia,serif;font-size:1.55rem;line-height:1;font-weight:700;}",
      ".rti-role{display:block;color:#cbbfa6;font-size:.78rem;}",
      ".rti-pip{width:22px;height:22px;display:block;}",
      ".rti-turn{margin:0;text-align:center;font-weight:700;min-width:9rem;max-width:14rem;}",
      ".rti-stage{position:relative;width:min(408px,100%,48vh);align-self:center;}",
      ".rti-stage::before{content:'';position:absolute;z-index:0;left:50%;top:42%;width:118%;height:88%;",
      "transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;",
      "background:radial-gradient(ellipse at 50% 48%,#5a3a24 0%,#2c1c12 60%,rgba(20,14,10,0) 76%);}",
      ".rti-frame{position:relative;z-index:1;padding:11px;border-radius:18px;",
      "background:repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 2px,transparent 2px 8px),",
      "linear-gradient(155deg,#c4844a,#6b3f22 32%,#3c2416 68%,#a86a38);",
      "box-shadow:inset 0 0 0 2px #f0d7a0,inset 0 0 0 5px #3a2416,0 10px 0 #24160e;}",
      ".rti-nail{position:absolute;width:9px;height:9px;border-radius:50%;",
      "background:radial-gradient(circle at 35% 35%,#fff6d0,#e1b044 42%,#7a5416);box-shadow:0 1px 1px rgba(0,0,0,.45);}",
      ".rti-nail.n1{top:6px;left:6px}.rti-nail.n2{top:6px;right:6px}",
      ".rti-nail.n3{bottom:6px;left:6px}.rti-nail.n4{bottom:6px;right:6px}",
      ".rti-board{display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);gap:3px;padding:3px;",
      "width:100%;aspect-ratio:1;background:#0c2818;border-radius:8px;overflow:hidden;",
      "box-shadow:inset 0 0 14px rgba(0,0,0,.45);}",
      ".rti:focus-visible .rti-frame{box-shadow:inset 0 0 0 2px #f0d7a0,inset 0 0 0 5px #3a2416,0 0 0 3px #e6a23c,0 10px 0 #24160e;}",
      ".rti-cell{position:relative;display:grid;place-items:center;min-width:0;min-height:0;cursor:pointer;touch-action:manipulation;",
      "background-color:#1b7348;background-image:radial-gradient(circle at 30% 30%,rgba(255,255,255,.09) 0 1px,transparent 1.6px),",
      "linear-gradient(#218656,#16683e);box-shadow:inset 0 0 0 1px rgba(0,0,0,.28);}",
      ".rti-cell.is-shade{background-color:#16683e;background-image:radial-gradient(circle at 70% 60%,rgba(0,0,0,.16) 0 1px,transparent 1.6px),",
      "linear-gradient(#1c7a4c,#125838);}",
      ".rti-cell.is-cursor{z-index:1;box-shadow:inset 7px 7px 0 -4px #f2c14a,inset -7px 7px 0 -4px #f2c14a,",
      "inset 7px -7px 0 -4px #f2c14a,inset -7px -7px 0 -4px #f2c14a;}",
      ".rti-cell.is-hint{background-color:#2f9a62;background-image:none;}",
      ".rti-cell.is-cursor.is-hint{box-shadow:inset 0 0 0 2px #fff4cc,inset 7px 7px 0 -4px #f2c14a,inset -7px 7px 0 -4px #f2c14a,",
      "inset 7px -7px 0 -4px #f2c14a,inset -7px -7px 0 -4px #f2c14a;}",
      ".rti-peek{position:absolute;width:42%;height:18%;opacity:0;pointer-events:none;}",
      ".rti-cell.is-legal .rti-peek{opacity:.9;}",
      ".rti-cell.is-hint .rti-peek path{fill:#f0c14b;}",
      ".rti-disc{width:80%;height:80%;display:block;transform:scale(0);pointer-events:none;overflow:visible;}",
      ".rti-disc.is-on{transform:scale(1);filter:drop-shadow(0 2px 1px rgba(0,0,0,.45));}",
      ".rti-disc .face{opacity:0;}",
      ".rti-disc.is-black .face-black,.rti-disc.is-white .face-white{opacity:1;}",
      ".rti-disc .sweat{opacity:0;}",
      ".rti-disc.is-last .sweat{opacity:1;}",
      ".rti-disc.is-new.is-on{animation:rti-in 320ms ease;}",
      "@keyframes rti-in{0%{transform:scaleX(.08) rotate(-8deg)}100%{transform:scaleX(1) rotate(0)}}",
      "@media (prefers-reduced-motion:reduce){.rti-disc.is-new.is-on{animation:none}}",
      ".rti-overlay{position:absolute;inset:0;z-index:2;display:grid;place-items:center;padding:16px;",
      "background:rgba(16,10,8,.62);border-radius:18px;}",
      ".rti-overlay[hidden]{display:none;}",
      ".rti-dialog{max-width:18rem;text-align:center;background:#2a1c14;border:3px solid #e0b45a;border-radius:16px;padding:16px 18px;",
      "box-shadow:0 12px 30px rgba(0,0,0,.35);}",
      ".rti-dialog h2{margin:0 0 6px;font-family:Georgia,serif;font-size:1.35rem;}",
      ".rti-dialog p{margin:0;color:#e6dccb;}",
      ".rti-cursor,.rti-aside,.rti-help{margin:0;text-align:center;}",
      ".rti-cursor{color:#f0d7a2;font-variant-numeric:tabular-nums;}",
      ".rti-aside{min-height:2.2em;color:#f6f0e4;}",
      ".rti-help{color:#e4d3b8;font-size:.82rem;}",
      "@media (max-width:560px){.rti{padding:8px 8px 12px}.rti-count{font-size:1.35rem}.rti-stage{width:min(100%,70vw)}}"
    ].join("");
  }

  function shellHtml() {
    sceneSerial += 1;
    var id = "rtiscene" + sceneSerial;
    var glow = id + "glow";
    return [
      '<svg class="rti-wallpaper" aria-hidden="true" preserveAspectRatio="xMidYMid slice">',
      "<defs>",
      '<pattern id="' + id + '" width="170" height="170" patternUnits="userSpaceOnUse">',
      '<rect width="170" height="170" fill="#1a120e"/>',
      '<g fill="none" stroke="#7a5336" stroke-width="1.5" opacity="0.38">',
      '<ellipse cx="40" cy="46" rx="18" ry="11"/>',
      '<circle cx="34" cy="46" r="3.2" fill="#7a5336" stroke="none"/>',
      '<path d="M26 32q10-10 18 2" stroke-linecap="round"/>',
      '<path d="M112 118q12 8 22-2" stroke-linecap="round"/>',
      '<path d="M118 52l9 14-9 14-9-14z"/>',
      "</g></pattern>",
      '<radialGradient id="' + glow + '" cx="50%" cy="36%" r="68%">',
      '<stop offset="0%" stop-color="#6a4630" stop-opacity="0.55"/>',
      '<stop offset="48%" stop-color="#1a120e" stop-opacity="0"/>',
      '<stop offset="100%" stop-color="#050302" stop-opacity="0.78"/>',
      "</radialGradient></defs>",
      '<rect width="100%" height="100%" fill="url(#' + id + ')"/>',
      '<rect width="100%" height="100%" fill="url(#' + glow + ')"/>',
      "</svg>",
      '<div class="rti-shell">',
      '<header class="rti-head">',
      '<svg class="rti-mascot" viewBox="0 0 148 58" aria-hidden="true">',
      '<circle cx="34" cy="31" r="24" fill="#111"/><circle cx="34" cy="29" r="22" fill="#2c2c2c"/>',
      '<ellipse cx="26" cy="27" rx="6" ry="7" fill="#f7f1e6"/><ellipse cx="42" cy="27" rx="6" ry="7" fill="#f7f1e6"/>',
      '<circle cx="29" cy="28" r="2.5" fill="#1a120c"/><circle cx="45" cy="28" r="2.5" fill="#1a120c"/>',
      '<path d="M20 18q6-6 12 1" fill="none" stroke="#111" stroke-width="2.2" stroke-linecap="round"/>',
      '<path d="M36 19q6-4 12 2" fill="none" stroke="#111" stroke-width="2.2" stroke-linecap="round"/>',
      '<path d="M24 39q10 7 18-2" fill="none" stroke="#e6d3b0" stroke-width="2.2" stroke-linecap="round"/>',
      '<circle cx="68" cy="30" r="2.1" fill="#e6c48a"/><circle cx="76" cy="30" r="2.1" fill="#e6c48a"/><circle cx="84" cy="30" r="2.1" fill="#e6c48a"/>',
      '<circle cx="114" cy="31" r="24" fill="#d9cbb8"/><circle cx="114" cy="29" r="22" fill="#fff8ee"/>',
      '<ellipse cx="106" cy="27" rx="6" ry="7" fill="#fff"/><ellipse cx="122" cy="27" rx="6" ry="7" fill="#fff"/>',
      '<circle cx="103" cy="29" r="2.5" fill="#2a2118"/><circle cx="119" cy="29" r="2.5" fill="#2a2118"/>',
      '<path d="M98 19q6-4 12 2" fill="none" stroke="#8a6a48" stroke-width="2.2" stroke-linecap="round"/>',
      '<path d="M116 18q6-6 14 1" fill="none" stroke="#8a6a48" stroke-width="2.2" stroke-linecap="round"/>',
      '<path d="M104 41q10-7 18 2" fill="none" stroke="#d07a74" stroke-width="2.2" stroke-linecap="round"/>',
      '<ellipse cx="96" cy="35" rx="4" ry="2.3" fill="#f0a0a0" opacity="0.75"/>',
      '<ellipse cx="132" cy="35" rx="4" ry="2.3" fill="#f0a0a0" opacity="0.75"/>',
      "</svg>",
      "<h1>Reversi: Othello with Trust Issues</h1>",
      '<p class="rti-rule">Outflank at least one disc in a straight line. Every outflanked disc flips. No legal move passes. Most discs wins. Ties count.</p>',
      '<div class="rti-modes">',
      '<button type="button" data-mode="solo" aria-pressed="true">You vs AI</button>',
      '<button type="button" data-mode="hotseat">Two humans</button>',
      "</div></header>",
      '<section class="rti-score">',
      '<div class="rti-side" data-side="black"><span class="rti-name">' + pipFace("black") + " Black</span>",
      '<strong class="rti-count" data-count="black">2</strong><span class="rti-role" data-role="black"></span></div>',
      '<p class="rti-turn" role="status"></p>',
      '<div class="rti-side" data-side="white"><span class="rti-name">' + pipFace("white") + " White</span>",
      '<strong class="rti-count" data-count="white">2</strong><span class="rti-role" data-role="white"></span></div>',
      "</section>",
      '<div class="rti-stage"><div class="rti-frame">',
      '<i class="rti-nail n1"></i><i class="rti-nail n2"></i><i class="rti-nail n3"></i><i class="rti-nail n4"></i>',
      '<div class="rti-board" role="grid" aria-label="Reversi board"></div></div>',
      '<div class="rti-overlay" hidden><div class="rti-dialog"><h2></h2><p></p></div></div></div>',
      '<p class="rti-cursor"></p>',
      '<p class="rti-aside"></p>',
      '<div class="rti-actions">',
      '<button type="button" data-act="hint">Hint</button>',
      '<button type="button" data-act="undo">Undo</button>',
      '<button type="button" data-act="pass">Pass</button>',
      '<button type="button" data-act="restart">Restart</button>',
      "</div>",
      '<p class="rti-help">Arrows move the cursor. Enter or Space places. H hint. U undo. P passes only when there is no legal move. R restart. Esc quits. Squares are a1 at the top left through h8.</p>',
      "</div>"
    ].join("");
  }

  global.DESKTOP_GAMES = global.DESKTOP_GAMES || {};
  global.DESKTOP_GAMES["reversi-trust-issues"] = {
    id: "reversi-trust-issues",
    title: "Reversi: Othello with Trust Issues",
    mount: mount
  };

  function bootPlayer() {
    var host;
    if (!document.body || !document.body.hasAttribute("data-game-player")) return;
    if (document.getElementById("reversi-trust-issues-root")) return;
    host = document.createElement("div");
    host.id = "reversi-trust-issues-root";
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.width = "100%";
    host.style.height = "100%";
    host.style.overflow = "auto";
    host.style.background = "#1a120e";
    document.documentElement.style.height = "100%";
    document.body.style.margin = "0";
    document.body.style.height = "100%";
    document.body.style.overflow = "hidden";
    document.body.style.background = "#1a120e";
    document.body.appendChild(host);
    global.DESKTOP_GAMES["reversi-trust-issues"].mount(host);
  }

  if (typeof document !== "undefined") {
    if (document.body && document.body.hasAttribute("data-game-player")) bootPlayer();
    else document.addEventListener("DOMContentLoaded", bootPlayer);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      BLACK: BLACK,
      WHITE: WHITE,
      flipsFor: flipsFor,
      legalMoves: legalMoves,
      applyMove: applyMove,
      opening: opening,
      counts: counts,
      outcome: outcome,
      rankMoves: rankMoves
    };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
