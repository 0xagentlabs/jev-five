"use client";

import { ArrowRight, Bot, Copy, Link2, Plus, ShieldCheck, Swords, Users } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./fighting.module.css";

export default function FightingHome() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  async function createFight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/fighting/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.get("name"),
          hostName: values.get("hostName"),
          hostSeat: values.get("hostSeat"),
          turnSeconds: Number(values.get("turnSeconds")),
          allowSpectators: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "创建失败");
      localStorage.setItem(`jev_fighting_player_${data.room.id}`, JSON.stringify(data.player));
      router.push(`/fighting/${data.room.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建失败，请重试。");
      setCreating(false);
    }
  }

  function joinFight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const code = String(values.get("roomCode") ?? "").trim().toUpperCase();
    if (!/^[A-Z2-9]{8}$/.test(code)) {
      setError("请输入 8 位房间码。");
      return;
    }
    setJoining(true);
    router.push(`/fighting/${code}`);
  }

  return (
    <main className={styles.fightingPage}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}><span><Swords size={20} /></span>Jev Fighting <small>ENGINE ARENA</small></Link>
        <Link href="/" className={styles.backLink}>返回 Jev Five</Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}><span /> LIVE ENGINE DUELS</span>
          <h1>让你的 Jev，<br /><em>迎战另一个 Jev。</em></h1>
          <p>创建一个房间，把链接发给对手。双方各自加载 Jev，准备完成后自动进行一场可观看、可回放的五子棋对战。</p>
          <div className={styles.steps} aria-label="对战流程">
            <span><b>01</b> 新建游戏</span><ArrowRight aria-hidden="true" />
            <span><b>02</b> 邀请对手</span><ArrowRight aria-hidden="true" />
            <span><b>03</b> 载入 Jev</span><ArrowRight aria-hidden="true" />
            <span><b>04</b> Fighting</span>
          </div>
        </div>

        <div className={styles.actionGrid}>
          <form className={styles.actionCard} onSubmit={createFight}>
            <div className={styles.cardTitle}><span><Plus /></span><div><small>HOST A FIGHT</small><h2>新建游戏</h2></div></div>
            <label>游戏名称<input name="name" defaultValue="周末 Jev 挑战赛" maxLength={48} required /></label>
            <label>你的昵称<input name="hostName" placeholder="例如 Cevin" maxLength={24} required /></label>
            <div className={styles.twoFields}>
              <label>你的席位<select name="hostSeat" defaultValue="black"><option value="black">黑方 · 先手</option><option value="white">白方 · 后手</option></select></label>
              <label>每步时限<select name="turnSeconds" defaultValue="60"><option value="15">15 秒</option><option value="30">30 秒</option><option value="60">60 秒</option><option value="120">120 秒</option></select></label>
            </div>
            <button className={styles.primaryButton} disabled={creating}>{creating ? "正在创建房间…" : "创建并获得邀请链接"}<ArrowRight size={17} /></button>
          </form>

          <form className={`${styles.actionCard} ${styles.joinCard}`} onSubmit={joinFight}>
            <div className={styles.cardTitle}><span><Link2 /></span><div><small>JOIN A FIGHT</small><h2>加入游戏</h2></div></div>
            <p>已经收到邀请？直接打开邀请链接，或在这里输入房间码。</p>
            <label>房间码<input className={styles.codeInput} name="roomCode" placeholder="ABCD2345" maxLength={8} autoCapitalize="characters" required /></label>
            <button className={styles.secondaryButton} disabled={joining}>{joining ? "正在进入…" : "进入等待室"}<ArrowRight size={17} /></button>
            <div className={styles.assurances}>
              <span><ShieldCheck size={16} /> API Key 只留在浏览器</span>
              <span><Users size={16} /> 支持分享与观战</span>
              <span><Copy size={16} /> 完整棋谱可回放</span>
            </div>
          </form>
        </div>
        {error && <div className={styles.error} role="alert">{error}</div>}
      </section>

      <section className={styles.guide}>
        <div><Bot size={26} /><span><small>NEW TO JEV?</small><h2>还没有 Jev 对手？</h2></span></div>
        <ol><li>在 TypeSafe Console 创建 API Key</li><li>进入等待室后点击“快速创建 Jev”</li><li>命名并选择战斗风格</li><li>连接测试通过后载入房间</li></ol>
        <a href="https://console.typesafe.ai/keys" target="_blank" rel="noreferrer">创建 TypeSafe API Key <ArrowRight size={16} /></a>
      </section>
    </main>
  );
}
