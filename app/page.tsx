"use client";

import { Bot, BrainCircuit, Eye, EyeOff, ExternalLink, KeyRound, RotateCcw, Swords, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Board, createBoard, getWinner, isBoardFull, otherStone, placeStone, Position, Stone, toLabel } from "@/lib/game";

type Mode = "human" | "duel";
type JevResult = { label: string; confidence?: number; probabilities: { label: string; probability: number }[]; latencyMs: number; model: string; move: Position; tactic?: string };
type MoveLog = { stone: Stone; label: string; actor: string; confidence?: number; latencyMs?: number };

const stoneName = (stone: Stone) => stone === "black" ? "黑方" : "白方";

export default function Home() {
  const [board, setBoard] = useState<Board>(createBoard);
  const [turn, setTurn] = useState<Stone>("black");
  const [mode, setMode] = useState<Mode>("human");
  const [humanStone, setHumanStone] = useState<Stone>("black");
  const [thinking, setThinking] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [jevKey, setJevKey] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [showKeyPrompt, setShowKeyPrompt] = useState(false);
  const [error, setError] = useState("");
  const [lastMove, setLastMove] = useState<Position | null>(null);
  const [result, setResult] = useState<JevResult | null>(null);
  const [logs, setLogs] = useState<MoveLog[]>([]);
  const requestId = useRef(0);
  const winner = useMemo(() => getWinner(board), [board]);
  const draw = !winner && isBoardFull(board);
  const gameOver = Boolean(winner || draw);

  useEffect(() => {
    const savedKey = window.sessionStorage.getItem("jev_typesafe_api_key") ?? "";
    setJevKey(savedKey);
    setKeyDraft(savedKey);
    fetch("/api/config", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        const isConfigured = Boolean(data.configured || savedKey);
        setConfigured(isConfigured);
        if (!isConfigured) setShowKeyPrompt(true);
      })
      .catch(() => setConfigured(Boolean(savedKey)));
  }, []);

  const saveKey = () => {
    const value = keyDraft.trim();
    if (!value) {
      setKeyError("请输入 TypeSafe API Key。");
      return;
    }
    if (value.length > 512) {
      setKeyError("API Key 长度异常，请检查后重试。");
      return;
    }
    window.sessionStorage.setItem("jev_typesafe_api_key", value);
    setJevKey(value);
    setConfigured(true);
    setKeyError("");
    setShowKeyPrompt(false);
  };

  const clearKey = () => {
    window.sessionStorage.removeItem("jev_typesafe_api_key");
    setJevKey("");
    setKeyDraft("");
    setConfigured(false);
    setShowKeyPrompt(true);
  };

  const reset = useCallback((nextMode = mode, nextHuman = humanStone) => {
    requestId.current += 1;
    setBoard(createBoard());
    setTurn("black");
    setLastMove(null);
    setResult(null);
    setLogs([]);
    setError("");
    setThinking(false);
    setAutoPlay(nextMode === "duel");
    setMode(nextMode);
    setHumanStone(nextHuman);
  }, [humanStone, mode]);

  const askJev = useCallback(async (activeBoard: Board, stone: Stone) => {
    if (!configured) {
      setShowKeyPrompt(true);
      setAutoPlay(false);
      return;
    }
    const id = ++requestId.current;
    setThinking(true);
    setError("");
    try {
      const response = await fetch("/api/move", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(jevKey ? { "X-TypeSafe-API-Key": jevKey } : {}) },
        body: JSON.stringify({ board: activeBoard, stone, persona: stone === "black" ? "attack" : "defense" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Jev 决策失败");
      if (requestId.current !== id) return;
      const nextBoard = placeStone(activeBoard, data.move, stone);
      setBoard(nextBoard);
      setLastMove(data.move);
      setResult(data);
      setLogs((items) => [...items, { stone, label: data.label, actor: mode === "duel" ? `Jev ${stone === "black" ? "Alpha" : "Beta"}` : "Jev", confidence: data.confidence, latencyMs: data.latencyMs }]);
      setTurn(otherStone(stone));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Jev 决策失败");
      setAutoPlay(false);
    } finally {
      if (requestId.current === id) setThinking(false);
    }
  }, [configured, jevKey, mode]);

  useEffect(() => {
    const shouldMove = !gameOver && !thinking && ((mode === "human" && turn !== humanStone) || (mode === "duel" && autoPlay));
    if (!shouldMove) return;
    const timer = window.setTimeout(() => askJev(board, turn), mode === "duel" ? 650 : 250);
    return () => window.clearTimeout(timer);
  }, [askJev, autoPlay, board, gameOver, humanStone, mode, thinking, turn]);

  const playHuman = (position: Position) => {
    if (mode !== "human" || turn !== humanStone || thinking || gameOver || board[position.row][position.col]) return;
    const nextBoard = placeStone(board, position, humanStone);
    setBoard(nextBoard);
    setLastMove(position);
    setResult(null);
    setLogs((items) => [...items, { stone: humanStone, label: toLabel(position), actor: "你" }]);
    setTurn(otherStone(humanStone));
  };

  const status = winner ? `${stoneName(winner)}胜出` : draw ? "平局" : thinking ? `${stoneName(turn)} · Jev 决策中` : `${stoneName(turn)}落子`;

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#game" aria-label="Jev Five 首页"><span className="brand-mark"><BrainCircuit size={20} /></span><span>Jev Five</span><small>System One Arena</small></a>
        <button className={`api-pill ${configured ? "ready" : "missing"}`} onClick={() => setShowKeyPrompt(true)}><span />{configured === null ? "检测配置" : configured ? "Jev 已连接" : "配置 API Key"}</button>
      </header>

      <section className="mode-switch" aria-label="对局模式">
        <button className={mode === "human" ? "active" : ""} onClick={() => reset("human", humanStone)}><UserRound size={18} /> 人类 vs Jev</button>
        <button className={mode === "duel" ? "active" : ""} onClick={() => reset("duel", humanStone)}><Swords size={18} /> Jev vs Jev</button>
      </section>

      <section id="game" className="game-shell">
        <aside className="panel left-panel">
          <div className="panel-heading"><span>对局控制</span><button className="icon-button" onClick={() => reset()} aria-label="重新开始"><RotateCcw size={17} /></button></div>
          {mode === "human" ? (
            <div className="setting"><label>你的棋子</label><div className="segmented"><button className={humanStone === "black" ? "selected" : ""} onClick={() => reset("human", "black")}><i className="mini-stone black" /> 黑</button><button className={humanStone === "white" ? "selected" : ""} onClick={() => reset("human", "white")}><i className="mini-stone white" /> 白</button></div></div>
          ) : (
            <div className="duel-cards"><div><Bot size={17} /><span>Jev Alpha<small>黑方 · 进攻型</small></span></div><div><Bot size={17} /><span>Jev Beta<small>白方 · 稳健型</small></span></div></div>
          )}
          <div className="turn-card"><span className={`turn-stone ${turn}`} /> <div><small>当前状态</small><strong>{status}</strong></div>{thinking && <span className="thinking-dots" aria-label="思考中"><i /><i /><i /></span>}</div>
          {mode === "duel" && <button className="wide-button" onClick={() => setAutoPlay((value) => !value)} disabled={gameOver}>{autoPlay ? "暂停对局" : logs.length ? "继续对局" : "开始对局"}</button>}
          <div className="move-list"><div className="section-label">落子记录 <span>{logs.length}</span></div>{logs.length === 0 ? <p className="empty">棋盘静候第一步。</p> : logs.slice().reverse().map((log, index) => <div className="move-row" key={`${logs.length - index}-${log.label}`}><span className={`move-no ${log.stone}`}>{logs.length - index}</span><div><strong>{log.actor}</strong><small>{log.confidence == null ? stoneName(log.stone) : `${Math.round(log.confidence * 100)}% confidence`}</small></div><b>{log.label}</b></div>)}</div>
        </aside>

        <div className="board-wrap">
          <div className="coordinates top">{Array.from({ length: 15 }, (_, index) => <span key={index}>{String.fromCharCode(65 + index)}</span>)}</div>
          <div className="row-coordinates">{Array.from({ length: 15 }, (_, index) => <span key={index}>{index + 1}</span>)}</div>
          <div className="board" role="grid" aria-label="15乘15五子棋棋盘">
            {board.map((row, rowIndex) => row.map((cell, colIndex) => {
              const position = { row: rowIndex, col: colIndex };
              const isLast = lastMove?.row === rowIndex && lastMove?.col === colIndex;
              return <button key={`${rowIndex}-${colIndex}`} role="gridcell" className={`cell ${isLast ? "last" : ""}`} onClick={() => playHuman(position)} disabled={Boolean(cell) || thinking || gameOver || mode !== "human" || turn !== humanStone} aria-label={`${toLabel(position)}${cell ? ` ${stoneName(cell)}` : " 空位"}`}>{cell && <span className={`stone ${cell}`}>{isLast && <i />}</span>}</button>;
            }))}
          </div>
          <div className="board-status"><span>{mode === "human" ? "HUMAN × JEV" : "JEV ALPHA × JEV BETA"}</span><span>15 × 15</span></div>
          {gameOver && <div className="game-over"><small>GAME OVER</small><strong>{winner ? `${stoneName(winner)}获胜` : "势均力敌，平局"}</strong><button onClick={() => reset()}>再来一局</button></div>}
        </div>

        <aside className="panel insight-panel">
          <div className="panel-heading"><span>Jev 决策台</span><span className="live-dot">LIVE</span></div>
          <div className="model-card"><small>HYBRID ENGINE</small><strong>Threat Search × Jev</strong><span>Selective 3-ply + jev-latest</span></div>
          {result ? <>
            <div className="decision-hero"><small>最新选择</small><strong>{result.label}</strong><span>{result.latencyMs} ms</span>{result.tactic && <p>{result.tactic}</p>}</div>
            <div className="confidence"><div><span>置信度</span><b>{result.confidence == null ? "—" : `${Math.round(result.confidence * 100)}%`}</b></div><div className="bar"><i style={{ width: `${(result.confidence ?? 0) * 100}%` }} /></div></div>
            <div className="candidates"><div className="section-label">TOP CHOICES</div>{result.probabilities.map((item) => <div key={item.label}><span>{item.label}</span><i><b style={{ width: `${Math.max(item.probability * 100, 2)}%` }} /></i><small>{Math.round(item.probability * 100)}%</small></div>)}</div>
          </> : <div className="insight-empty"><BrainCircuit size={30} /><strong>等待 Jev 决策</strong><p>每次响应只返回预定义坐标，不生成自由文本。</p></div>}
          {error && <div className="error-box" role="alert">{error}<button onClick={() => askJev(board, turn)}>重试</button></div>}
          <div className="primitive"><span>DECISION PIPELINE</span><code>threat search → choice()</code><p>识别跳四、眠四、四三杀、双三与活二，再经三层对手回应搜索，最后由 Jev 决策。</p></div>
        </aside>
      </section>

      {showKeyPrompt && <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="key-title"><button className="modal-close" onClick={() => setShowKeyPrompt(false)} aria-label="关闭提示"><X size={19} /></button><span className="modal-icon"><KeyRound /></span><small>BRING YOUR OWN KEY</small><h2 id="key-title">配置 Jev API Key</h2><p>填入 TypeSafe 官方密钥即可开始对局。密钥仅保存在当前浏览器会话中，关闭标签页后自动清除。</p><div className="key-field"><label htmlFor="jev-api-key">TypeSafe API Key</label><div><input id="jev-api-key" type={showKey ? "text" : "password"} value={keyDraft} onChange={(event) => { setKeyDraft(event.target.value); setKeyError(""); }} onKeyDown={(event) => { if (event.key === "Enter") saveKey(); }} placeholder="粘贴你的 API Key" autoComplete="off" spellCheck={false} aria-describedby="key-help key-error" autoFocus /><button type="button" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? "隐藏 API Key" : "显示 API Key"}>{showKey ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><small id="key-help">通过 HTTPS 发送给本站服务端代理，不会写入数据库或构建产物。</small>{keyError && <strong id="key-error" role="alert">{keyError}</strong>}</div><button className="modal-cta key-submit" onClick={saveKey}>保存并开始</button>{jevKey && <button className="text-button danger-text" onClick={clearKey}>清除当前会话密钥</button>}<a className="text-link" href="https://console.typesafe.ai/settings/keys" target="_blank" rel="noreferrer">获取官方 API Key <ExternalLink size={14} /></a><button className="text-button" onClick={() => setShowKeyPrompt(false)}>先看看棋盘</button></section></div>}
    </main>
  );
}
