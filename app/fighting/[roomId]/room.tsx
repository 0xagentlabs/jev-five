"use client";

import { Bot, Check, Clock3, Copy, ExternalLink, LoaderCircle, Play, Radio, Share2, ShieldCheck, Swords, Users, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { PublicFightingRoom } from "@/lib/fighting";
import { Stone } from "@/lib/game";
import styles from "../fighting.module.css";

type Identity = { id: string; token: string; seat: Stone };
type MoveResult = { move: { row: number; col: number }; confidence?: number; latencyMs?: number };

const seatName = (seat: Stone) => seat === "black" ? "黑方" : "白方";

export default function FightRoom({ roomId }: { roomId: string }) {
  const [room, setRoom] = useState<PublicFightingRoom | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEngine, setShowEngine] = useState(false);
  const [copied, setCopied] = useState(false);
  const moving = useRef(false);

  const readRoom = useCallback(async () => {
    try {
      const response = await fetch(`/api/fighting/rooms/${roomId}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "读取房间失败");
      setRoom(data.room);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "读取房间失败");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`jev_fighting_player_${roomId}`);
      if (saved) setIdentity(JSON.parse(saved));
    } catch { /* invalid local identity is treated as spectator */ }
    void readRoom();
    const poller = window.setInterval(readRoom, 1500);
    return () => window.clearInterval(poller);
  }, [readRoom, roomId]);

  const myPlayer = identity ? room?.players[identity.seat] : undefined;
  const isHost = Boolean(identity && room?.hostPlayerId === identity.id);

  const action = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch(`/api/fighting/rooms/${roomId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "操作失败");
    setRoom(data.room);
    return data;
  }, [roomId]);

  useEffect(() => {
    if (!room || !identity || !myPlayer?.engine || room.status !== "active" || room.turn !== identity.seat || moving.current) return;
    moving.current = true;
    const run = async () => {
      try {
        const key = localStorage.getItem("jev_typesafe_api_key") ?? "";
        if (!key) throw new Error("当前浏览器没有 Jev API Key，请重新载入 Jev。");
        const response = await fetch("/api/move", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-TypeSafe-API-Key": key },
          body: JSON.stringify({ board: room.board, stone: identity.seat, persona: myPlayer.engine?.persona === "defense" ? "defense" : "attack" }),
        });
        const result: MoveResult & { message?: string } = await response.json();
        if (!response.ok) throw new Error(result.message || "Jev 决策失败");
        await action({ action: "move", token: identity.token, move: result.move, confidence: result.confidence, latencyMs: result.latencyMs });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Jev 决策失败");
      } finally {
        moving.current = false;
      }
    };
    void run();
  }, [action, identity, myPlayer?.engine, room]);

  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      const data = await action({ action: "join", name: values.get("name"), seat: values.get("seat") });
      localStorage.setItem(`jev_fighting_player_${roomId}`, JSON.stringify(data.player));
      setIdentity(data.player);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "加入失败"); }
  }

  async function configure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identity || !room) return;
    const values = new FormData(event.currentTarget);
    const key = String(values.get("apiKey") ?? "").trim();
    const engineName = String(values.get("engineName") ?? "").trim();
    const persona = String(values.get("persona") ?? "attack");
    if (!key || !engineName) { setError("请填写 API Key 和 Jev 名称。"); return; }
    setError("");
    try {
      const test = await fetch("/api/move", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-TypeSafe-API-Key": key },
        body: JSON.stringify({ board: Array.from({ length: 15 }, () => Array(15).fill(null)), stone: identity.seat, persona: persona === "defense" ? "defense" : "attack" }),
      });
      const tested = await test.json();
      if (!test.ok) throw new Error(tested.message || "Jev 连接测试失败");
      localStorage.setItem("jev_typesafe_api_key", key);
      await action({ action: "configure", token: identity.token, engineName, persona });
      setShowEngine(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "载入 Jev 失败"); }
  }

  async function start() {
    if (!identity) return;
    try { await action({ action: "start", token: identity.token }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "开始失败"); }
  }

  async function share() {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: room?.name ?? "Jev Fighting", url });
    else await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const outcome = room?.status === "black_win" ? "黑方获胜" : room?.status === "white_win" ? "白方获胜" : room?.status === "draw" ? "平局" : null;
  const remainingSeat = room?.players.black ? "white" : "black";

  if (loading) return <main className={styles.roomLoading}><LoaderCircle className={styles.spinner} /> 正在进入 Fighting Room…</main>;
  if (!room) return <main className={styles.roomLoading}><strong>无法进入房间</strong><p>{error}</p><Link href="/fighting">返回 Jev Fighting</Link></main>;

  return (
    <main className={styles.roomPage}>
      <header className={styles.roomHeader}>
        <Link href="/fighting" className={styles.brand}><span><Swords size={20} /></span>Jev Fighting</Link>
        <div className={styles.roomIdentity}><small>ROOM</small><b>{room.id}</b><button onClick={share}>{copied ? <Check /> : <Share2 />}<span>{copied ? "已复制" : "分享"}</span></button></div>
      </header>

      <section className={styles.roomTitle}>
        <div><span className={styles.liveBadge}><Radio size={13} /> {room.status === "active" ? "LIVE" : outcome ? "FINISHED" : "LOBBY"}</span><h1>{room.name}</h1><p>{room.turnSeconds} 秒/步 · 房间 24 小时有效 · {room.allowSpectators ? "允许观战" : "仅限玩家"}</p></div>
        {!identity && room.players.black && room.players.white && <span className={styles.spectator}><Users /> 观众模式</span>}
      </section>

      <section className={styles.fightLayout}>
        <aside className={styles.roster}>
          {(["black", "white"] as const).map((seat) => {
            const player = room.players[seat];
            return <div className={`${styles.playerCard} ${room.turn === seat && room.status === "active" ? styles.currentPlayer : ""}`} key={seat}>
              <span className={`${styles.playerStone} ${styles[seat]}`} />
              <div><small>{seatName(seat)} · {seat === "black" ? "先手" : "后手"}</small><strong>{player?.name ?? "等待玩家加入"}</strong><span>{player?.engine ? <><Bot size={13} /> {player.engine.name} · {player.engine.persona}</> : "Jev 未载入"}</span></div>
              {player?.engine && <Check className={styles.readyCheck} />}
            </div>;
          })}

          {!identity && (!room.players.black || !room.players.white) && <form className={styles.joinForm} onSubmit={join}>
            <h2>加入 {seatName(remainingSeat)}</h2>
            <label>你的昵称<input name="name" maxLength={24} placeholder="输入昵称" required /></label>
            <input type="hidden" name="seat" value={remainingSeat} />
            <button className={styles.primaryButton}>加入这个席位</button>
          </form>}

          {identity && !myPlayer?.engine && <button className={styles.primaryButton} onClick={() => setShowEngine(true)}><Bot /> 快速创建并载入 Jev</button>}
          {identity && myPlayer?.engine && room.status !== "active" && !outcome && <button className={styles.secondaryButton} onClick={() => setShowEngine(true)}><Bot /> 更换我的 Jev</button>}
          {isHost && room.status === "ready" && <button className={styles.startButton} onClick={start}><Play /> 开始 Fighting</button>}
          {room.status === "waiting" && <button className={styles.shareButton} onClick={share}><Copy /> 复制邀请链接</button>}
          {error && <div className={styles.error} role="alert">{error}</div>}
        </aside>

        <div className={styles.fightBoardWrap}>
          <div className={styles.fightBoard} role="grid" aria-label="15乘15五子棋对战棋盘">
            {room.board.map((row, rowIndex) => row.map((cell, colIndex) => {
              const isLast = room.moves.at(-1)?.row === rowIndex && room.moves.at(-1)?.col === colIndex;
              return <span role="gridcell" aria-label={`${String.fromCharCode(65 + colIndex)}${rowIndex + 1}${cell ? ` ${seatName(cell)}` : " 空位"}`} className={`${styles.fightCell} ${isLast ? styles.lastCell : ""}`} key={`${rowIndex}-${colIndex}`}>{cell && <i className={`${styles.fightStone} ${styles[cell]}`} />}</span>;
            }))}
          </div>
          <div className={styles.boardMeta}><span>{outcome ?? (room.status === "active" ? `${seatName(room.turn)} Jev 决策中` : room.status === "ready" ? "双方已准备" : "等待双方载入 Jev")}</span><b>{room.moves.length} MOVES</b></div>
          {outcome && <div className={styles.outcome}><small>FIGHT COMPLETE</small><strong>{outcome}</strong><span>完整棋谱已保存在房间中</span></div>}
        </div>

        <aside className={styles.fightLog}>
          <div className={styles.logHeading}><span>对战记录</span><span><Clock3 /> {room.turnSeconds}s</span></div>
          {room.moves.length === 0 ? <div className={styles.emptyLog}><Swords /><strong>等待开战</strong><p>双方载入 Jev 后，由房主开始对局。</p></div> : room.moves.slice().reverse().map((move) => <div className={styles.logMove} key={move.turn}><b>{String(move.turn).padStart(2, "0")}</b><span className={`${styles.logStone} ${styles[move.stone]}`} /><div><strong>{move.engineName}</strong><small>{move.latencyMs} ms{move.confidence == null ? "" : ` · ${Math.round(move.confidence * 100)}%`}</small></div><code>{move.label}</code></div>)}
        </aside>
      </section>

      <section className={styles.helpCard}>
        <ShieldCheck /><div><small>HOW TO CREATE A JEV OPPONENT</small><h2>还没有 Jev？四步完成</h2><p>在 TypeSafe Console 创建 API Key → 点击“快速创建并载入 Jev” → 命名并选择战斗风格 → 连接测试通过后等待开战。Key 只保存在当前浏览器，不会写入房间或分享给对手。</p></div><a href="https://console.typesafe.ai/keys" target="_blank" rel="noreferrer">创建 API Key <ExternalLink /></a>
      </section>

      {showEngine && <div className={styles.modalBackdrop} role="presentation"><form className={styles.engineModal} role="dialog" aria-modal="true" aria-labelledby="engine-title" onSubmit={configure}>
        <button type="button" className={styles.closeButton} onClick={() => setShowEngine(false)} aria-label="关闭"><X /></button>
        <span className={styles.modalIcon}><Bot /></span><small>QUICK JEV SETUP · 1 / 1</small><h2 id="engine-title">创建你的 Jev 对手</h2><p>它将使用你的 TypeSafe Key 和当前 Jev Five 棋力核心。连接测试成功后，只会把 Jev 名称和风格公开给房间。</p>
        <label>Jev 名称<input name="engineName" defaultValue={`${myPlayer?.name ?? "My"} Jev`} maxLength={32} required /></label>
        <label>TypeSafe API Key<input name="apiKey" type="password" defaultValue={typeof window === "undefined" ? "" : localStorage.getItem("jev_typesafe_api_key") ?? ""} autoComplete="off" maxLength={512} required /><small>仅保存于这个浏览器的 localStorage。</small></label>
        <fieldset><legend>战斗风格</legend><label><input type="radio" name="persona" value="attack" defaultChecked />进攻 · 主动制造威胁</label><label><input type="radio" name="persona" value="balanced" />均衡 · 攻守兼顾</label><label><input type="radio" name="persona" value="defense" />防守 · 优先封堵</label></fieldset>
        <button className={styles.primaryButton}>测试连接并载入 Jev</button>
      </form></div>}
    </main>
  );
}
