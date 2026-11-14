// space-ui-design キット / kit.tsx
// client/src/kit.tsx にそのまま置く。画面はここの部品を組み合わせて作る。
// 見た目（色・書体・角丸・影・間隔・空間の組み方）は theme.css が持っている。
// 画面側では <Page theme="…" archetype="…" shell="…"> を選び、部品を「並べるだけ」。
// 縦の間隔は自動で付くので、mt-* を足さない。
// 横に並べるときは Columns / Split / Grid / FieldRow を使う（PCで横幅を使うための部品）。

import { isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export type Tone = "accent" | "pop" | "ok" | "warn" | "bad";

/**
 * 空間の組み方（骨格・箱の扱い・密度）。アプリの性格に合わせて1つ選ぶ。
 *   editorial（紙面調・箱なし）: しおり・記事・計画・ノート・記録。箱で囲まず余白と細い線で見せる
 *   panel（高密度パネル・計器調）: ダッシュボード・運用・監視・管理ツール。締まった余白と1pxの仕切り線
 *   card（やわらかいカード調）: 日常の道具・依頼窓口・趣味・コレクション。親しみやすいカードと余白
 */
export type Archetype = "card" | "editorial" | "panel";

/**
 * 画面上部の骨格（App Shell）。同じ部品でも「アプリの顔つき」を切り替える。
 *   masthead: 紙面風の見出し＋右寄せタブ（editorial の既定。しおり・読み物・単一目的アプリ向き）
 *   topbar:   題・タブ・操作を1本のスリムなバーに収める（panel の既定。ツール・2〜3タブ向き）
 *   rail:     PCで左サイドナビ、スマホで上部タブ（タブが3〜4個ある運用・管理ワークスペース向き）
 *   standard: ゆとりのある2段ヘッダー（card の既定。マスコットを置くポップな画面向き）
 */
export type Shell = "standard" | "topbar" | "masthead" | "rail";

/**
 * テーマ = 色 ＋ 質感。名前を1つ選ぶ。
 *   pop（やわらかい）:        sora / ichigo / matcha
 *   minimal（静かな紙・墨）:  sumi / kinari
 *   precision（端正な道具）:  kiri
 *   future（計器・サイバー）: mirai
 * 選び方は references/themes.md。
 */
export const THEMES = {
  sora: "pop",
  ichigo: "pop",
  matcha: "pop",
  sumi: "minimal",
  kinari: "minimal",
  kiri: "precision",
  mirai: "future",
} as const;
export type ThemeName = keyof typeof THEMES;

export const DEFAULT_ARCHETYPE: Record<ThemeName, Archetype> = {
  sora: "card",
  ichigo: "card",
  matcha: "card",
  sumi: "editorial",
  kinari: "editorial",
  kiri: "panel",
  mirai: "panel",
};

/** PC（幅900px以上）かどうか。Split が内部で使う。画面側で出し分けに使うのは最小限に。 */
export function useIsDesktop() {
  const query = "(min-width: 900px)";
  const [is, setIs] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setIs(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return is;
}

// ---- 動きの仕上げ（部品の内部用。<Page motion> のときだけ見た目に効く） ----

/** 動きが有効か（<Page motion> が付いていて、端末が「動きを減らす」設定でない）。 */
function motionOn() {
  return document.documentElement.hasAttribute("data-motion") && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** key が変わるたびに "a" → "b" → "a" … を返す（最初は undefined）。CSS の入る動きをやり直す合図。 */
function useEnter(key: string | undefined): "a" | "b" | undefined {
  const ref = useRef({ key, n: 0 });
  if (ref.current.key !== key) ref.current = { key, n: ref.current.n + 1 };
  const n = ref.current.n;
  return n === 0 || key === undefined ? undefined : n % 2 ? "a" : "b";
}

/** タブ・絞り込みの「選択の印」の位置を測って、器の CSS 変数に書く。 */
function useInk(sig: string) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const place = () => {
      const on = box.querySelector<HTMLElement>('.k-tab[aria-selected="true"], .k-tab[aria-pressed="true"]');
      if (!on) {
        delete box.dataset.ink;
        return;
      }
      const b = box.getBoundingClientRect();
      const r = on.getBoundingClientRect();
      box.style.setProperty("--ink-x", `${r.left - b.left + box.scrollLeft - box.clientLeft}px`);
      box.style.setProperty("--ink-y", `${r.top - b.top + box.scrollTop - box.clientTop}px`);
      box.style.setProperty("--ink-w", `${r.width}px`);
      box.style.setProperty("--ink-h", `${r.height}px`);
      box.dataset.ink = "";
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    // 画面幅や書体の読み込みで大きさが変わったら、置き直す
    const ro = new ResizeObserver(place);
    ro.observe(box);
    box.querySelectorAll(".k-tab").forEach((t) => ro.observe(t));
    return () => ro.disconnect();
  }, [sig]);
  return ref;
}

// ---- アイコン（部品の内部用。画面のアイコンは lucide-react を使ってよい） ----
function Svg({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const ICON = {
  chevron: "m9 6 6 6-6 6",
  close: "M6 6l12 12M18 6 6 18",
  check: "m5 12.5 4.5 4.5L19 7.5",
  help: "M9.2 9a3 3 0 1 1 4.6 2.5c-.9.6-1.8 1.3-1.8 2.5M12 17.5v.5",
  alert: "M12 8v5M12 16.5v.5M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
};

// ---- ページ枠 ---------------------------------------------------------------

/** 画面全体の枠。アプリのいちばん外側に1つだけ置く。 */
export function Page({
  title,
  sub,
  theme = "sora",
  archetype,
  shell,
  mascot,
  actions,
  primaryAction,
  tabs,
  width = "wide",
  motion = false,
  children,
}: {
  /** アプリの名前。短く（〜12文字）。タブを切り替えても変えない。説明文は入れない。 */
  title: string;
  /** 題のそばの小さな1行（〜16文字）。「18:42 時点」「11/8（日）」のような、画面全体に関わる短い事実だけ。 */
  sub?: string;
  theme?: ThemeName;
  /** 空間の組み方（"editorial" | "panel" | "card"）。省略時はテーマに合うものが選ばれる。 */
  archetype?: Archetype;
  /** 画面上部の骨格（"masthead" | "topbar" | "rail" | "standard"）。省略時は archetype に合うものが選ばれる。 */
  shell?: Shell;
  /** <Mascot /> を渡す。無ければ出ない。 */
  mascot?: ReactNode;
  /** 右上（rail では左ナビ下部）の小さな操作。多くても2つ（例: <HelpButton />、更新ボタン）。 */
  actions?: ReactNode;
  /**
   * この画面でいちばんやってほしい操作（1つだけ）。
   * PCではヘッダー右（rail では左ナビ内）、スマホでは画面下に浮かぶボタンになる。フォーム画面では使わず <ActionBar> を使う。
   */
  primaryAction?: { label: string; onClick: () => void; icon?: ReactNode };
  /** <Tabs /> を渡す。 */
  tabs?: ReactNode;
  /**
   * ふつうは "wide"（既定）。PCでは Columns / Split / Grid で横幅を使う。
   * "narrow"（760px）は、どのタブも「フォームだけ・読み物だけ」で、横に並べるものが本当に無いアプリだけ。
   */
  width?: "wide" | "narrow";
  /**
   * 動きの仕上げ（タブ切替のフェード・選択の印の移動・Sheet を閉じる動き・残量バーの伸び縮み など）。
   * 最初に画面を作るときは付けない。「アニメーションを付けて」と頼まれたときだけ、references/motion.md の手順で付ける。
   */
  motion?: boolean;
  children: ReactNode;
}) {
  const tabKey = isValidElement(tabs) ? String((tabs.props as { value?: unknown }).value ?? "") : undefined;
  const enter = useEnter(tabKey);
  const resolvedArchetype: Archetype = archetype ?? DEFAULT_ARCHETYPE[theme] ?? "card";
  const defaultShell: Shell =
    resolvedArchetype === "editorial" ? "masthead" : resolvedArchetype === "panel" ? "topbar" : "standard";
  const requestedShell = shell ?? defaultShell;
  const resolvedShell: Shell = requestedShell === "rail" && !tabs ? "topbar" : requestedShell;

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (theme === "sora") delete root.dataset.theme;
    else root.dataset.theme = theme;
    const style = THEMES[theme] ?? "pop";
    if (style === "pop") delete root.dataset.style;
    else root.dataset.style = style;
    root.dataset.archetype = resolvedArchetype;
    root.dataset.shell = resolvedShell;
    if (motion) root.dataset.motion = "";
    else delete root.dataset.motion;
  }, [theme, resolvedArchetype, resolvedShell, motion]);

  return (
    <div className="k-app" lang="ja">
      <div className="k-page" data-width={width} data-archetype={resolvedArchetype} data-shell={resolvedShell}>
        <header className="k-header">
          <div className="k-brand">
            {mascot}
            <div className="k-header-text">
              <h1 className="k-header-title">{title}</h1>
              {sub ? <p className="k-header-sub">{sub}</p> : null}
            </div>
          </div>
          {tabs ? <div className="k-header-nav">{tabs}</div> : null}
          {actions || primaryAction ? (
            <div className="k-header-actions">
              {actions}
              {primaryAction ? (
                <button type="button" className="k-btn k-primary-desktop" data-variant="primary" onClick={primaryAction.onClick}>
                  {primaryAction.icon}
                  {primaryAction.label}
                </button>
              ) : null}
            </div>
          ) : null}
        </header>
        <main className="k-main k-flow" data-enter={enter}>{children}</main>
      </div>
      {primaryAction ? (
        <div className="k-fab">
          <button type="button" className="k-btn" data-variant="primary" onClick={primaryAction.onClick}>
            {primaryAction.icon}
            {primaryAction.label}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** マスコット画像。高さは必ず size で決める（Tailwind の h-* では決めない）。 */
export function Mascot({ src, size = 56, alt = "", hop = false }: { src: string; size?: number; alt?: string; hop?: boolean }) {
  return <img className="k-mascot" src={src} alt={alt} data-hop={hop ? "" : undefined} style={{ ["--mascot-h" as string]: `${size}px` }} />;
}

export type TabItem<T extends string> = { id: T; label: string; badge?: number };

/** ページの切替。2〜4個まで。5個以上になるなら画面の分け方を見直す。 */
export function Tabs<T extends string>({ items, value, onChange, label = "画面の切替" }: { items: (TabItem<T> | T)[]; value: T; onChange: (id: T) => void; label?: string }) {
  const ref = useInk(`${value}/${items.length}`);
  return (
    <div ref={ref} className="k-tabs" role="tablist" aria-label={label}>
      <span className="k-tab-ink" aria-hidden="true" />
      {items.map((raw) => {
        const it = typeof raw === "string" ? { id: raw, label: raw } : raw;
        return (
          <button key={it.id} type="button" role="tab" aria-selected={it.id === value} className="k-tab" onClick={() => onChange(it.id)}>
            <span className="k-tab-label">{it.label}</span>
            {it.badge ? <span className="k-badge">{it.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** 一覧の絞り込み。選択肢は2〜4個。セレクトボックスを並べる代わりにこれを1つ使う。 */
export function Segmented<T extends string>({ items, value, onChange, label = "絞り込み" }: { items: (TabItem<T> | T)[]; value: T; onChange: (id: T) => void; label?: string }) {
  const ref = useInk(`${value}/${items.length}`);
  return (
    <div ref={ref} className="k-seg" role="group" aria-label={label}>
      <span className="k-tab-ink" aria-hidden="true" />
      {items.map((raw) => {
        const it = typeof raw === "string" ? { id: raw, label: raw } : raw;
        return (
          <button key={it.id} type="button" aria-pressed={it.id === value} className="k-tab" onClick={() => onChange(it.id)}>
            <span className="k-tab-label">{it.label}</span>
            {it.badge ? <span className="k-badge">{it.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * PCだけ2カラム。スマホでは main → aside の順に縦に並ぶ。
 * aside には「main に無い、短いまとまり」を置く（持ち物・お金・送った依頼・次にすること）。
 * ratio="even" で左右を同じ幅にする（フォーム＋送った一覧、など）。
 * aside を省くと、main だけが読みやすい幅（760px）で左に寄る。
 */
export function Columns({ main, aside, children, ratio = "main" }: { main?: ReactNode; aside?: ReactNode; children?: ReactNode; ratio?: "main" | "even" }) {
  const parts = Array.isArray(children) ? children : children ? [children] : [];
  const left = main ?? parts[0] ?? null;
  const right = aside ?? (main === undefined && parts.length > 1 ? parts.slice(1) : undefined);
  return (
    <div className="k-cols" data-ratio={ratio} data-solo={right ? undefined : ""}>
      <div className="k-flow">{left}</div>
      {right ? <aside className="k-flow">{right}</aside> : null}
    </div>
  );
}

/**
 * 一覧＋詳細。PCでは左に一覧・右に詳細が並び、スマホでは一覧だけ出て詳細は Sheet で開く。
 * 「行を押すと詳細」の画面は、Sheet を直接使わずにこれを使う（PCで横幅が活きる）。
 */
export function Split({
  list,
  title,
  detail,
  footer,
  onClose,
  onSelectFirst,
  placeholder = "左から選ぶと、ここに出ます",
}: {
  /** 左側（スマホではこれだけが出る）。Notice・Segmented・Card などを並べてよい。 */
  list: ReactNode;
  /** 選ばれている1件の題。 */
  title?: string;
  /** 選ばれている1件の中身。何も選ばれていなければ null。 */
  detail: ReactNode | null;
  /** 詳細の下に置くボタン（「レポートを読む」など）。 */
  footer?: ReactNode;
  /** スマホで Sheet を閉じたとき。選択を外す処理を渡す。 */
  onClose: () => void;
  /** PCで何も選ばれていないときに呼ばれる。最初の1件を選ぶ処理を渡す（右側を空にしないため）。 */
  onSelectFirst?: () => void;
  placeholder?: string;
}) {
  const desktop = useIsDesktop();
  const has = detail !== null && detail !== undefined && detail !== false;
  const enter = useEnter(has ? (title ?? "") : undefined);
  useEffect(() => {
    if (desktop && !has) onSelectFirst?.();
  }, [desktop, has, onSelectFirst]);
  return (
    <div className="k-split">
      <div className="k-flow">{list}</div>
      {desktop ? (
        <div className="k-split-detail" data-enter={enter}>
          {has ? (
            <>
              {title ? (
                <div className="k-split-head">
                  <h2 className="k-split-title">{title}</h2>
                </div>
              ) : null}
              <div className="k-split-body k-flow">{detail}</div>
              {footer ? <div className="k-split-foot">{footer}</div> : null}
            </>
          ) : (
            <p className="k-split-empty">{placeholder}</p>
          )}
        </div>
      ) : (
        <Sheet open={has} title={title ?? ""} onClose={onClose} footer={footer}>
          {detail}
        </Sheet>
      )}
    </div>
  );
}

/**
 * カードを並べる。PCでは幅に合わせて2〜3列、スマホでは1列になる。
 * 3件以下のものを中身ごと見せるとき（サービスごとの残量、未決の判断）や、段階・候補のカードに使う。
 * min は1枚の最小幅（px）。中身が多いカードは 360、小さいカードは 240。
 */
export function Grid({ children, min = 300 }: { children: ReactNode; min?: number }) {
  return (
    <div className="k-grid" style={{ ["--grid-min" as string]: `${min}px` }}>
      {children}
    </div>
  );
}

/** 縦に並べる（箱の中で使う）。間隔は s=6px / m=12px / l=20px。mt-* の代わりにこれを使う。 */
export function Stack({ children, gap = "m" }: { children: ReactNode; gap?: "s" | "m" | "l" }) {
  return (
    <div className="k-stack" data-gap={gap === "m" ? undefined : gap}>
      {children}
    </div>
  );
}

/**
 * 文章の1段落。<p className="text-sm ..."> を手書きする代わりに使う。
 * dim=補足の色 / size="sm"=小さめ / strong=太字。長い文はPCでも読みやすい幅で折り返す。
 */
export function Text({ children, dim = false, size = "base", strong = false }: { children: ReactNode; dim?: boolean; size?: "base" | "sm" | "xs"; strong?: boolean }) {
  return (
    <p className="k-text" data-dim={dim ? "" : undefined} data-size={size === "base" ? undefined : size} data-strong={strong ? "" : undefined}>
      {children}
    </p>
  );
}

/** 箱（Card・Sheet）の中の小さな見出し。Section を入れ子にする代わりに使う。 */
export function SubHead({ children }: { children: ReactNode }) {
  return <h4 className="k-subhead">{children}</h4>;
}

// ---- かたまり ---------------------------------------------------------------

/**
 * 見出しつきのまとまり。meta は「3件」のような短い数だけ。説明文は書かない。
 * 中に置いた部品（Segmented・Card・Grid・KeyValues・Stats など）は、自動で縦に間隔が空く。
 */
export function Section({ title, meta, action, children }: { title: string; meta?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="k-section">
      <div className="k-section-head">
        <h2 className="k-section-title">
          <span>{title}</span>
        </h2>
        {action ?? (meta ? <span className="k-section-meta">{meta}</span> : null)}
      </div>
      <div className="k-flow" data-gap="s">
        {children}
      </div>
    </section>
  );
}

/**
 * まとまりの器。Card の中に Card を入れない。
 * editorial では単独の箱は紙面に溶け込み、Grid の中や title つきのときだけ輪郭を持つ。
 * 1行だけの文字（「22:15まで」など）のためだけに Card を作らない（Hero の facts か KeyValues にまとめる）。
 * variant="subtle" は脇役の控えめな面、variant="flat" は枠線も背景も持たない素のまとまり。
 */
export function Card({
  children,
  roomy = false,
  title,
  trail,
  variant = "default",
}: {
  children: ReactNode;
  roomy?: boolean;
  title?: string;
  trail?: ReactNode;
  variant?: "default" | "subtle" | "flat";
}) {
  return (
    <div
      className="k-card k-flow"
      data-gap="s"
      data-pad={roomy || title ? "roomy" : undefined}
      data-titled={title ? "" : undefined}
      data-variant={variant === "default" ? undefined : variant}
    >
      {title ? (
        <div className="k-card-head">
          <h3 className="k-card-title">{title}</h3>
          {trail}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/**
 * 画面の主役。1画面（1タブ）に1つだけ。「いま一番知りたいこと」を value に入れる。
 * 例: label="つぎの電車" value="07:30" unit="あと12分" title="和歌山市駅 4番線" sub="特急サザン8号 ・ なんば行"
 * facts に2〜3個の関連する短い事実（[["なんば着", "08:32"], ["帰着見込み", "21:19"]] など）を添えると、
 * 1行だけの小カードを別に作らずに済み、主役のまとまりが引き締まる。
 */
export function Hero({
  label,
  value,
  unit,
  title,
  sub,
  facts,
  tone = "accent",
  actions,
  aside,
}: {
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  title?: ReactNode;
  sub?: ReactNode;
  /** 主役に添える2〜3個の短い事実（[ラベル, 値]）。別に小さな Card を作る代わりにここへまとめる。 */
  facts?: [label: string, value: ReactNode][];
  tone?: "accent" | "pop" | "warn" | "bad";
  actions?: ReactNode;
  /** 右下に置く <Mascot />（高さは88px以上で表示される）。 */
  aside?: ReactNode;
}) {
  return (
    <div className="k-hero" data-tone={tone} data-has-facts={facts && facts.length > 0 ? "" : undefined}>
      <div className="k-hero-body">
        <div className="k-hero-primary">
          <p className="k-hero-label">{label}</p>
          <p className="k-hero-value">
            {value}
            {unit ? <small>{unit}</small> : null}
          </p>
        </div>
        {title || sub || actions ? (
          <div className="k-hero-detail">
            {title ? <p className="k-hero-title">{title}</p> : null}
            {sub ? <p className="k-hero-sub">{sub}</p> : null}
            {actions ? <div className="k-hero-actions">{actions}</div> : null}
          </div>
        ) : null}
        {facts && facts.length > 0 ? (
          <dl className="k-hero-facts">
            {facts.map(([k, v]) => (
              <div key={k} className="k-hero-fact">
                <dt>{k}</dt>
                <dd className="k-num">{v}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      {aside ? <div className="k-hero-aside">{aside}</div> : null}
    </div>
  );
}

// ---- 行 ---------------------------------------------------------------------

export function List({ children }: { children: ReactNode }) {
  return <ul className="k-list">{children}</ul>;
}

/**
 * 一覧の1行。「先頭（時刻 or アイコン）＋ 題 ＋ 補足1行 ＋ 右端1つ」まで。
 * それ以上の情報は onClick で開く Split（または Sheet）に入れる。
 */
export function Row({
  lead,
  icon,
  iconTone,
  title,
  meta,
  trail,
  onClick,
  dim = false,
  selected = false,
}: {
  /** 時刻など短い文字（"07:30"）。icon とどちらか一方。 */
  lead?: string;
  icon?: ReactNode;
  iconTone?: Tone;
  title: ReactNode;
  /** 補足は1行。項目は「 ・ 」で区切って3つまで。 */
  meta?: ReactNode;
  /** 右端。<Chip /> か短い値を1つ。 */
  trail?: ReactNode;
  onClick?: () => void;
  /** 済んだ・過去のものを薄くする。 */
  dim?: boolean;
  /** Split で、この行の詳細を右に出しているとき true。 */
  selected?: boolean;
}) {
  const inner = (
    <>
      {lead ? <span className="k-row-lead">{lead}</span> : null}
      {icon ? (
        <span className="k-row-icon" data-tone={iconTone}>
          {icon}
        </span>
      ) : null}
      <span className="k-row-body">
        <span className="k-row-title">{title}</span>
        {meta ? <span className="k-row-meta">{meta}</span> : null}
      </span>
      {trail ? <span className="k-row-trail">{trail}</span> : null}
      {onClick ? (
        <span className="k-chev">
          <Svg d={ICON.chevron} size={18} />
        </span>
      ) : null}
    </>
  );
  return (
    <li>
      {onClick ? (
        <button type="button" className="k-row" data-dim={dim ? "" : undefined} aria-current={selected ? "true" : undefined} onClick={onClick}>
          {inner}
        </button>
      ) : (
        <div className="k-row" data-dim={dim ? "" : undefined}>
          {inner}
        </div>
      )}
    </li>
  );
}

/** チェックできる行（持ち物・やること）。状態は「済 / まだ」の2つだけ。 */
export function CheckRow({ title, meta, checked, onChange }: { title: ReactNode; meta?: ReactNode; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <li>
      <button type="button" role="checkbox" aria-checked={checked} className="k-check" onClick={() => onChange(!checked)}>
        <span className="k-check-box">
          <Svg d={ICON.check} size={16} />
        </span>
        <span className="k-row-body">
          <span className="k-row-title">{title}</span>
          {meta ? <span className="k-row-meta">{meta}</span> : null}
        </span>
      </button>
    </li>
  );
}

/** 状態を1語で示すラベル。1行に1つまで。文章を入れない（〜6文字）。 */
export function Chip({ tone, dot = false, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className="k-chip" data-tone={tone} data-dot={dot ? "" : undefined}>
      {children}
    </span>
  );
}

// ---- 時刻の流れ --------------------------------------------------------------

export function Timeline({ children }: { children: ReactNode }) {
  return <ol className="k-tl">{children}</ol>;
}

/**
 * 時刻つきの1件。state: "done"=過ぎた / "now"=いま進行中、またはつぎの1件だけ / 省略=これから。
 * minor は徒歩・乗換のような「つなぎ」を小さく1行で出す（meta は付けない）。
 * くわしい中身は onClick で Sheet を開いて見せる（全部の行に Disclosure を付けない）。
 */
export function TimelineItem({
  time,
  title,
  meta,
  trail,
  state,
  minor = false,
  onClick,
  children,
}: {
  time?: string;
  title: ReactNode;
  /** 補足は1行。その場で要る情報（番線・場所）を入れる。 */
  meta?: ReactNode;
  /** 右端。注意があるときだけ <Chip /> を1つ。 */
  trail?: ReactNode;
  state?: "done" | "now";
  minor?: boolean;
  /** 押すと詳細の Sheet を開く。 */
  onClick?: () => void;
  /** この1件だけに付く特別な中身（例: 帰りの電車の「乗り遅れたとき」の Disclosure）。全行には付けない。 */
  children?: ReactNode;
}) {
  const head = (
    <>
      <span className="k-row-body">
        <span className="k-row-title">{title}</span>
        {meta ? <span className="k-row-meta">{meta}</span> : null}
      </span>
      {trail ? <span className="k-row-trail">{trail}</span> : null}
      {onClick ? (
        <span className="k-chev">
          <Svg d={ICON.chevron} size={18} />
        </span>
      ) : null}
    </>
  );
  return (
    <li className="k-tl-item" data-state={state} data-kind={minor ? "minor" : undefined}>
      <span className="k-tl-time">{time ?? ""}</span>
      <span className="k-tl-rail">
        <span className="k-tl-dot" />
      </span>
      <div className="k-tl-body">
        {onClick ? (
          <button type="button" className="k-tl-head" onClick={onClick}>
            {head}
          </button>
        ) : (
          <div className="k-tl-head">{head}</div>
        )}
        {children}
      </div>
    </li>
  );
}

// ---- 数字・内訳 -------------------------------------------------------------

export function Stats({ children }: { children: ReactNode }) {
  return <dl className="k-stats">{children}</dl>;
}

/** 小さな数字。2〜4個並べる。Section 直下にそのまま置いてもよい（箱で囲まなくてよい）。 */
export function Stat({ label, value, unit }: { label: string; value: ReactNode; unit?: string }) {
  return (
    <div className="k-stat-cell">
      <dt className="k-stat-label">{label}</dt>
      <dd className="k-stat-value">
        {value}
        {unit ? <small>{unit}</small> : null}
      </dd>
    </div>
  );
}

/**
 * 「項目: 値」の並び。詳細画面のほか、右列（aside）での内訳・時刻のまとめ（2〜6件）にも使える。
 * align="between" にすると値が右端にそろい、金額の内訳や時刻表に向く。
 * foot={["合計", "3,480円"]} を渡すと、区切り線つきの合計・結論行が下に付く。
 */
export function KeyValues({
  items,
  align = "left",
  foot,
}: {
  items: [label: string, value: ReactNode][];
  align?: "left" | "between";
  foot?: [label: string, value: ReactNode];
}) {
  return (
    <dl className="k-kv" data-align={align === "between" ? "between" : undefined}>
      {items.map(([label, value]) => (
        <div key={label} className="k-kv-row">
          <dt>{label}</dt>
          <dd className="k-num">{value}</dd>
        </div>
      ))}
      {foot ? (
        <div className="k-kv-row k-kv-foot">
          <dt>{foot[0]}</dt>
          <dd className="k-num">{foot[1]}</dd>
        </div>
      ) : null}
    </dl>
  );
}

/**
 * 残量・進み具合を「名前 ＋ 値 ＋ バー ＋ 補足」で見せる1行。
 * 残量や使用率が主題の画面では、これを Card の中に並べて最初から見せる（Row に畳んで隠さない）。
 * 例: <MeterRow label="週間" value="残り22%" percent={22} tone="warn" sub="あす 22:05 に戻る" />
 * tone は**量で決める**（残りが30%以下＝"warn"、10%以下＝"bad"、十分なら付けない）。
 * 「データが古い」のような量以外の注意は、tone ではなく sub に書く。
 */
export function MeterRow({ label, value, percent, tone, sub }: { label: string; value: ReactNode; percent: number; tone?: "ok" | "warn" | "bad"; sub?: ReactNode }) {
  return (
    <div className="k-meterrow">
      <div className="k-meterrow-head">
        <span className="k-meterrow-label">{label}</span>
        <span className="k-meterrow-value" data-tone={tone}>
          {value}
        </span>
      </div>
      <Meter value={percent} tone={tone} label={label} />
      {sub ? <p className="k-meterrow-sub">{sub}</p> : null}
    </div>
  );
}

/** 0〜100 の残量・進み具合（バーだけ）。 */
export function Meter({ value, tone, label }: { value: number; tone?: "ok" | "warn" | "bad"; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="k-meter" data-tone={tone} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

// ---- 操作 -------------------------------------------------------------------

/**
 * ボタン。primary は1画面に1つだけ（いちばんやってほしい操作）。
 * ラベルは「何が起きるか」を動詞で（"送信" より "調査を依頼する"）。
 */
export function Button({
  children,
  variant = "soft",
  size = "m",
  block = false,
  icon,
  disabled,
  type = "button",
  onClick,
}: {
  children: ReactNode;
  variant?: "primary" | "soft" | "ghost" | "danger";
  size?: "m" | "s";
  block?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button type={type} className="k-btn" data-variant={variant} data-size={size} data-block={block ? "" : undefined} disabled={disabled} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}

/** アイコンだけの丸ボタン。label は読み上げ用に必須。 */
export function IconButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className="k-iconbtn" aria-label={label} onClick={onClick}>
      {icon}
    </button>
  );
}

/** 文字だけの軽い操作（「すべて見る」など）。 */
export function LinkButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className="k-link" onClick={onClick}>
      {children}
      <Svg d={ICON.chevron} size={16} />
    </button>
  );
}

// ---- しまう・ひらく ----------------------------------------------------------

/** その場で開く詳細。「たまにしか見ない情報」を畳んでおく。 */
export function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="k-disc">
      <summary>
        <Svg d={ICON.chevron} size={16} />
        {label}
      </summary>
      <div className="k-disc-body">{children}</div>
    </details>
  );
}

/**
 * 重ねて出すパネル（スマホは下から、PCは中央）。確認・ヘルプ・短い入力に使う。
 * 「一覧の行の詳細」は、これを直接使わず Split に任せる（PCでは横に並ぶ）。
 * size="l" は中身が多いときのPC用の広い幅（760px）。
 */
export function Sheet({ open, title, onClose, footer, size = "m", children }: { open: boolean; title: string; onClose: () => void; footer?: ReactNode; size?: "m" | "l"; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // 閉じる動きのあいだだけ、最後に出していた中身のまま表示を残す（動きがオフなら、その場で消える）
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);
  const closing = shown && !open;
  const last = useRef({ title, footer, children });
  if (open) last.current = { title, footer, children };
  const view = open ? { title, footer, children } : last.current;
  useLayoutEffect(() => {
    if (!closing) return;
    if (!motionOn()) {
      setShown(false);
      return;
    }
    const t = window.setTimeout(() => setShown(false), 450);
    return () => window.clearTimeout(t);
  }, [closing]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open && !shown) return null;
  return (
    <div
      className="k-sheet-back"
      data-state={closing ? "closing" : undefined}
      aria-hidden={closing ? "true" : undefined}
      onClick={closing ? undefined : onClose}
      onAnimationEnd={(e) => {
        if (closing && e.target === e.currentTarget) setShown(false);
      }}
    >
      <div ref={panel} className="k-sheet" data-size={size} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="k-sheet-head">
          <h2 id={titleId} className="k-sheet-title">
            {view.title}
          </h2>
          <IconButton label="閉じる" icon={<Svg d={ICON.close} />} onClick={onClose} />
        </div>
        <div className="k-sheet-body k-flow">{view.children}</div>
        {view.footer ? <div className="k-sheet-foot">{view.footer}</div> : null}
      </div>
    </div>
  );
}

/** 右上に置く「？」。画面の説明文はすべてここ（ヘルプ用 Sheet）に集める。 */
export function HelpButton({ onClick }: { onClick: () => void }) {
  return <IconButton label="使い方" icon={<Svg d={ICON.help} />} onClick={onClick} />;
}

/** ヘルプや長文用の文章ブロック（Sheet の中だけで使う）。 */
export function Prose({ children }: { children: ReactNode }) {
  return <div className="k-prose">{children}</div>;
}

// ---- 声かけ -----------------------------------------------------------------

/**
 * 行動が必要なときだけ出す帯。説明や豆知識には使わない。
 * 例: <Notice tone="warn" action={<Button size="s">確認する</Button>}>承認待ちが2件</Notice>
 */
export function Notice({ tone = "warn", children, action }: { tone?: "warn" | "bad" | "accent"; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="k-notice" data-tone={tone} role="status">
      <span className="k-notice-icon">
        <Svg d={ICON.alert} size={18} />
      </span>
      <span className="k-notice-body">{children}</span>
      {action}
    </div>
  );
}

/** マスコットのひとこと。1画面に1つまで、1〜2行。いまの状況を話し言葉で。 */
export function Bubble({ mascot, children }: { mascot: ReactNode; children: ReactNode }) {
  return (
    <div className="k-bubble-wrap">
      {mascot}
      <p className="k-bubble">{children}</p>
    </div>
  );
}

/** 中身が0件のとき。「何もない」ではなく「次に何をすればいいか」を1つ出す。 */
export function Empty({ title, mascot, action }: { title: string; mascot?: ReactNode; action?: ReactNode }) {
  return (
    <div className="k-empty">
      {mascot}
      <p className="k-empty-title">{title}</p>
      {action}
    </div>
  );
}

// ---- フォーム ---------------------------------------------------------------

/**
 * 入力欄の枠。ラベルは名詞で短く。必須が多いフォームでは必須マークを付けず、
 * 任意のほうに optional を付ける。書き方の例は説明文ではなく placeholder に入れる。
 */
export function Field({ label, optional = false, error, children }: { label: string; optional?: boolean; error?: string; children: ReactNode }) {
  return (
    <label className="k-field" data-error={error ? "" : undefined}>
      <span className="k-field-label">
        {label}
        {optional ? <span className="k-field-opt">任意</span> : null}
      </span>
      {children}
      {error ? <p className="k-field-error">{error}</p> : null}
    </label>
  );
}

export function TextInput(props: { value: string; onChange: (v: string) => void; placeholder?: string; type?: "text" | "search" | "url" | "email" | "number" }) {
  return <input className="k-input" type={props.type ?? "text"} value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />;
}

export function TextArea(props: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea className="k-input" rows={props.rows ?? 3} value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />;
}

export function Select<T extends string>(props: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <select className="k-input" value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** 短い入力欄を横に2つ並べる（日付と時刻、姓と名）。スマホでは縦に並ぶ。中に Field を2つ入れる。 */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="k-fieldrow">{children}</div>;
}

/** フォームの実行ボタン置き場。スマホでは画面下に貼りつく。primary を1つ入れる。 */
export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="k-bar">{children}</div>;
}
