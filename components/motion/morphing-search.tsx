"use client";

import { type LucideIcon, Search } from "lucide-react";
import {
	AnimatePresence,
	LayoutGroup,
	motion,
	type Transition,
	useReducedMotion,
} from "motion/react";
import {
	Fragment,
	type KeyboardEvent as ReactKeyboardEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import { useOnOpen } from "@/lib/hooks/use-on-open";
import { useRowCursor } from "@/lib/hooks/use-row-cursor";
import { cn } from "@/lib/utils";

// Keeps the Wallet Card feel with a little more time to read the morph.
const SEARCH_MORPH: Transition = {
	type: "spring",
	duration: 0.58,
	bounce: 0.22,
};

// Keep the spring on the shell, but unfold complex clip-path values with the
// same progressive tween as Morph Popover so the content never snaps ahead.
const SEARCH_CLIP_TRANSITION: Transition = {
	duration: 0.32,
	ease: EASE_OUT,
};

/** One MorphingSearch overlay at a time. Homepage hero + chrome both mount this. */
const MORPH_OPEN_EVENT = "rr:morphing-search-open";

/**
 * What the wide panel shows beside the list for the row under the cursor: a
 * photograph, a name and the row's own figures, each with its label. Only the
 * caller's published figures go here; the panel never derives one.
 */
export type MorphingSearchPreview = {
	photo?: string;
	eyebrow?: string;
	title: string;
	figures?: { value: string; label: string }[];
	note?: string;
	cta?: string;
};

export type MorphingSearchItem = {
	id: string;
	title: string;
	description?: string;
	keywords?: string[];
	icon?: LucideIcon;
	onSelect?: () => void;
	/** The heading the row sits under. Consecutive rows with one group share it. */
	group?: string;
	/** The row's figure with its unit ("1,044 houses for sale", "$1,624,900"). */
	meta?: string;
	/** 0..1: the row's figure as a share of its group's largest, drawn as a rule. */
	measure?: number;
	/** A small photograph at the row's start (a listing's lead photo, a place). */
	thumb?: string;
	/** The wide panel's preview for this row. */
	preview?: MorphingSearchPreview;
};

export interface MorphingSearchProps {
	items: MorphingSearchItem[];
	placeholder?: string;
	shortcut?: string;
	/** Render the closed trigger as a compact search icon. */
	iconOnly?: boolean;
	emptyMessage?: string;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	onQueryChange?: (query: string) => void;
	onSelect?: (item: MorphingSearchItem) => void;
	className?: string;
	/**
	 * Classes for the portaled overlay layer (the click catcher, the morph
	 * panel and the dialog all resolve against it). The default `z-50` sits
	 * BELOW a sticky site header at z-index 100, so a search anchored inside
	 * that header opened with its input row hidden behind the chrome and only
	 * the result list showing (Matt, phone, 2026-09-16: "I cannot type in the
	 * search"). A host whose header stacks above 50 passes its own z here.
	 */
	overlayClassName?: string;
	/**
	 * How wide the open panel may grow (px). The demo's 448 is the default; a
	 * front-door search passes more, and the field then opens into a results
	 * surface with a preview pane once there is room for one (720px and up).
	 */
	panelMaxWidth?: number;
	/** How tall the results may grow (px) before they scroll. Default 288. */
	resultsMaxHeight?: number;
	/** Dim the page behind the open panel (navy scrim, no blur). */
	scrim?: boolean;
	/** A row under the results, across the panel (a "search everything" door). */
	footer?: ReactNode;
}

type AnchorRect = {
	top: number;
	left: number;
	width: number;
};

function isEditableTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;
	return (
		target.isContentEditable ||
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement
	);
}

export function MorphingSearch({
	items,
	placeholder = "Search",
	shortcut = "f",
	iconOnly = false,
	emptyMessage = "No results found.",
	open: controlledOpen,
	defaultOpen = false,
	onOpenChange,
	onQueryChange,
	onSelect,
	className,
	overlayClassName = "z-[150]",
	panelMaxWidth = 448,
	resultsMaxHeight = 288,
	scrim = false,
	footer,
}: MorphingSearchProps) {
	const [internalOpen, setInternalOpen] = useState(defaultOpen);
	const [query, setQuery] = useState("");
	const [mounted, setMounted] = useState(false);
	const [backgroundScrollLocked, setBackgroundScrollLocked] =
		useState(defaultOpen);
	const [anchorRect, setAnchorRect] = useState<AnchorRect>({
		top: 16,
		left: 16,
		width: 0,
	});
	const open = controlledOpen ?? internalOpen;
	const controlled = controlledOpen !== undefined;
	const reduce = useReducedMotion();
	const uid = useId();
	const anchorRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const dialogRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);
	const wasOpenRef = useRef(open);
	const transition: Transition = reduce ? { duration: 0 } : SPRING_LAYOUT;
	const morphTransition: Transition = reduce ? { duration: 0 } : SEARCH_MORPH;

	const setOpen = useCallback(
		(next: boolean) => {
			if (!controlled) setInternalOpen(next);
			onOpenChange?.(next);
		},
		[controlled, onOpenChange],
	);

	const measureAnchor = useCallback(() => {
		const rect = anchorRef.current?.getBoundingClientRect();
		if (!rect) return;
		setAnchorRect({ top: rect.top, left: rect.left, width: rect.width });
	}, []);

	const openSearch = useCallback(() => {
		measureAnchor();
		setBackgroundScrollLocked(true);
		previousFocusRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		setOpen(true);
	}, [measureAnchor, setOpen]);

	const filteredItems = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return items;

		return items.filter((item) =>
			[item.title, item.description ?? "", ...(item.keywords ?? [])]
				.join(" ")
				.toLowerCase()
				.includes(needle),
		);
	}, [items, query]);

	const { activeIndex, moveTo, moveActive } = useRowCursor(filteredItems, query);

	// The cursor is stamped with the query, so changing it drops the highlight
	// without this having to say so.
	const updateQuery = useCallback(
		(next: string) => {
			setQuery(next);
			onQueryChange?.(next);
		},
		[onQueryChange],
	);

	const closeSearch = useCallback(() => {
		updateQuery("");
		setOpen(false);
	}, [setOpen, updateQuery]);

	useEffect(() => setMounted(true), []);

	useEffect(() => {
		if (open) setBackgroundScrollLocked(true);
	}, [open]);

	useEffect(() => {
		measureAnchor();
		const anchor = anchorRef.current;
		const observer =
			anchor && typeof ResizeObserver !== "undefined"
				? new ResizeObserver(measureAnchor)
				: null;
		if (anchor) observer?.observe(anchor);
		window.addEventListener("resize", measureAnchor);
		document.addEventListener("scroll", measureAnchor, true);
		window.visualViewport?.addEventListener("resize", measureAnchor);
		window.visualViewport?.addEventListener("scroll", measureAnchor);
		return () => {
			observer?.disconnect();
			window.removeEventListener("resize", measureAnchor);
			document.removeEventListener("scroll", measureAnchor, true);
			window.visualViewport?.removeEventListener("resize", measureAnchor);
			window.visualViewport?.removeEventListener("scroll", measureAnchor);
		};
	}, [measureAnchor]);

	useEffect(() => {
		if (!backgroundScrollLocked) return;

		const isInsideOpenSearch = (target: EventTarget | null) =>
			target instanceof Node &&
			Boolean(
				dialogRef.current?.contains(target) || listRef.current?.contains(target),
			);
		const preventBackgroundWheel = (event: WheelEvent) => {
			if (isInsideOpenSearch(event.target)) return;
			event.preventDefault();
		};
		const preventBackgroundTouch = (event: TouchEvent) => {
			if (isInsideOpenSearch(event.target)) return;
			event.preventDefault();
		};

		document.addEventListener("wheel", preventBackgroundWheel, {
			passive: false,
		});
		document.addEventListener("touchmove", preventBackgroundTouch, {
			passive: false,
		});
		return () => {
			document.removeEventListener("wheel", preventBackgroundWheel);
			document.removeEventListener("touchmove", preventBackgroundTouch);
		};
	}, [backgroundScrollLocked]);

	useEffect(() => {
		const handleShortcut = (event: KeyboardEvent) => {
			if (event.key === "Escape" && open) {
				event.preventDefault();
				closeSearch();
				return;
			}

			if (
				!open &&
				shortcut &&
				event.key.toLowerCase() === shortcut.toLowerCase() &&
				!event.repeat &&
				!event.metaKey &&
				!event.ctrlKey &&
				!event.altKey &&
				!event.shiftKey &&
				!isEditableTarget(event.target)
			) {
				const rect = anchorRef.current?.getBoundingClientRect();
				if (!rect || rect.width < 8) return;
				event.preventDefault();
				openSearch();
			}
		};

		window.addEventListener("keydown", handleShortcut);
		return () => window.removeEventListener("keydown", handleShortcut);
	}, [closeSearch, open, openSearch, shortcut]);

	useEffect(() => {
		const onOther = (event: Event) => {
			const other = (event as CustomEvent<string>).detail;
			if (other === uid) return;
			if (open) closeSearch();
		};
		window.addEventListener(MORPH_OPEN_EVENT, onOther);
		return () => window.removeEventListener(MORPH_OPEN_EVENT, onOther);
	}, [closeSearch, open, uid]);

	useEffect(() => {
		if (!open) return;
		window.dispatchEvent(new CustomEvent(MORPH_OPEN_EVENT, { detail: uid }));
	}, [open, uid]);

	// Only this component's own state. Telling the consumer the query changed is
	// a side effect, so it waits for the effect below.
	useOnOpen(open, () => {
		setQuery("");
		moveTo(null);
	});

	// Keyed to `open` alone. `onQueryChange` is read through a ref because an
	// inline one changes identity on every keystroke, and this effect clearing
	// the field on every keystroke is exactly what that costs. Written after
	// commit for the reason `lib/hooks/use-row-cursor.ts` gives at length.
	const notifyQuery = useRef(onQueryChange);
	useLayoutEffect(() => {
		notifyQuery.current = onQueryChange;
	});

	useEffect(() => {
		if (open) {
			notifyQuery.current?.("");
			const frame = requestAnimationFrame(() => inputRef.current?.focus());
			return () => cancelAnimationFrame(frame);
		}

		if (wasOpenRef.current) {
			const frame = requestAnimationFrame(() => {
				const previousFocus = previousFocusRef.current;
				const focusTarget = previousFocus?.isConnected
					? previousFocus
					: triggerRef.current;
				// Handed back, not moved to: the target was on screen when the
				// dialog opened and the page stayed put under it, so returning
				// focus never scrolls. In the site's sticky header a scroll here
				// jumped the page about 400px (V3Chrome.css).
				focusTarget?.focus({ preventScroll: true });
			});
			return () => cancelAnimationFrame(frame);
		}
	}, [open]);

	useEffect(() => {
		wasOpenRef.current = open;
	}, [open]);

	useEffect(() => {
		if (!open) return;
		listRef.current
			?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
			?.scrollIntoView({ block: "nearest" });
	}, [activeIndex, open]);

	const selectItem = useCallback(
		(item: MorphingSearchItem) => {
			item.onSelect?.();
			onSelect?.(item);
			closeSearch();
		},
		[closeSearch, onSelect],
	);

	const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			moveActive(1);
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			moveActive(-1);
			return;
		}

		if (event.key === "Enter") {
			event.preventDefault();
			const item = filteredItems[activeIndex];
			if (item) selectItem(item);
			return;
		}

		if (event.key !== "Tab" || !dialogRef.current) return;
		const focusable = Array.from(
			dialogRef.current.querySelectorAll<HTMLElement>(
				'input, button:not([disabled]), [tabindex]:not([tabindex="-1"])',
			),
		);
		const first = focusable[0];
		const last = focusable.at(-1);
		if (!first || !last) return;

		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	};

	const shellLayoutId = `${uid}-shell`;
	const listboxId = `${uid}-results`;
	// A compact (icon-only) trigger sits at the far edge of a phone header, so a
	// panel measured from the icon's left edge to the viewport was ~150px wide
	// and hung off the right of a 375px screen. Icon-only opens as a full-width
	// sheet instead: as wide as the viewport allows, clamped inside its gutters,
	// still anchored to the trigger's top so the morph has an origin.
	const viewportWidth = mounted ? window.innerWidth : 0;
	// A front-door search (panelMaxWidth past the demo's 448) grows from the
	// field into a results surface: as wide as the viewport allows inside 16px
	// gutters, shifted left only as far as it must be to stay on screen.
	const wide = panelMaxWidth > 448;
	const panelWidth = mounted
		? iconOnly
			? Math.max(anchorRect.width, Math.min(448, viewportWidth - 24))
			: wide
				? Math.max(
						anchorRect.width,
						Math.min(panelMaxWidth, viewportWidth - 32),
					)
				: Math.max(
						anchorRect.width,
						Math.min(448, viewportWidth - anchorRect.left - 16),
					)
		: anchorRect.width;
	const panelLeft = mounted
		? iconOnly
			? Math.max(12, Math.min(anchorRect.left, viewportWidth - panelWidth - 12))
			: wide
				? Math.max(16, Math.min(anchorRect.left, viewportWidth - panelWidth - 16))
				: anchorRect.left
		: anchorRect.left;
	const footerHeight = footer != null ? 52 : 0;
	const rowHeight = items.some((item) => item.thumb || item.measure != null)
		? 60
		: 52;
	const resultsHeight = mounted
		? Math.max(
				96,
				Math.min(
					resultsMaxHeight,
					window.innerHeight - anchorRect.top - 80 - footerHeight,
					wide
						? resultsMaxHeight
						: Math.max(filteredItems.length, 1) * rowHeight + 16,
				),
			)
		: resultsMaxHeight;
	// The preview pane needs room beside the list; on a phone the list's own
	// thumbnails and figures carry the row.
	const showPreview =
		wide && panelWidth >= 720 && items.some((item) => item.preview);
	const activeItem = filteredItems[activeIndex] ?? null;
	const leftInset = Math.max(0, anchorRect.left - panelLeft);
	const collapsedContentClip = `inset(0px ${Math.max(
		0,
		panelWidth - anchorRect.width - leftInset,
	)}px ${resultsHeight + footerHeight}px ${leftInset}px round 12px)`;
	const expandedContentClip = "inset(0px 0px 0px 0px round 12px)";
	// Rows grouped under their headings, each keeping its place in the
	// keyboard order (data-index is the row's index in filteredItems).
	const groups: { name: string | null; rows: { item: MorphingSearchItem; index: number }[] }[] = [];
	filteredItems.forEach((item, index) => {
		const name = item.group ?? null;
		const last = groups.at(-1);
		if (last && last.name === name) last.rows.push({ item, index });
		else groups.push({ name, rows: [{ item, index }] });
	});

	// Neither grouping layer carries a box: they only hold `inert`/`aria-hidden`,
	// the z-index and the presence key, and every child below is `fixed` and
	// resolves against the viewport itself. The grouping child is a plain div
	// (not motion.div) so Framer does not put a transform on a size-0 box and
	// turn it into the containing block for the dialog. The click catcher sits
	// at z-0; the layoutId shell is pointer-events-none (iOS backdrop-filter +
	// shared-layout projection otherwise paint on top of the input and swallow
	// taps — SITE-121 residual, Matt 2026-09-18). See
	// tests/fixed-overlay-edge-sampling.test.tsx.
	const thumbGroups = new Set(
		filteredItems.filter((row) => row.thumb).map((row) => row.group ?? ""),
	);
	const groupHasThumb = (item: MorphingSearchItem) =>
		thumbGroups.has(item.group ?? "");
	const renderRow = (item: MorphingSearchItem, index: number) => {
		const Icon = item.icon;
		const active = index === activeIndex;
		const measure =
			item.measure != null && Number.isFinite(item.measure)
				? Math.max(0, Math.min(1, item.measure))
				: null;
		return (
			<button
				key={item.id}
				id={`${uid}-option-${index}`}
				type="button"
				role="option"
				aria-selected={active}
				data-index={index}
				onMouseMove={() => moveTo(item.id)}
				onFocus={() => moveTo(item.id)}
				onClick={() => selectItem(item)}
				className="relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
			>
				{active ? (
					<motion.span
						layoutId={`${uid}-active-result`}
						className="absolute inset-0 rounded-lg bg-foreground/5"
						transition={transition}
					/>
				) : null}
				{item.thumb ? (
					// A plate drawn at 56px: the optimizer is off site-wide
					// (next.config images.unoptimized), so next/image would add
					// only its inline style. Eager: the row exists only while the
					// panel is open, so it is on screen when it mounts.
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={item.thumb}
						alt=""
						loading="eager"
						decoding="async"
						data-v3-morph="thumb"
						className="relative h-[42px] w-14 shrink-0 rounded-md object-cover"
					/>
				) : groupHasThumb(item) ? (
					// A row without a photograph in a group of photographed rows
					// keeps the column with a plate, never a gap.
					<span
						aria-hidden="true"
						data-v3-morph="thumb-plate"
						className="relative h-[42px] w-14 shrink-0 rounded-md bg-foreground/10"
					/>
				) : Icon ? (
					<Icon className="relative size-4 shrink-0 text-muted-foreground" />
				) : null}
				<span className="relative min-w-0 flex-1">
					<span className="flex items-baseline gap-3">
						<span className="block min-w-0 flex-1 truncate text-sm font-medium text-foreground">
							{item.title}
						</span>
						{item.meta ? (
							<span
								data-v3-morph="meta"
								className="shrink-0 text-xs font-medium tabular-nums text-foreground"
							>
								{item.meta}
							</span>
						) : null}
					</span>
					{item.description ? (
						<span className="block truncate text-xs text-muted-foreground">
							{item.description}
						</span>
					) : null}
					{measure != null ? (
						<span
							aria-hidden="true"
							data-v3-morph="measure"
							className="relative mt-1.5 block h-[3px] w-full bg-foreground/10"
						>
							<span
								className="absolute inset-y-0 left-0 bg-foreground"
								style={{ width: `${Math.max(measure * 100, 1.5)}%` }}
							/>
						</span>
					) : null}
				</span>
			</button>
		);
	};

	const triggerVisible = mounted && anchorRect.width >= 8;
	const overlay =
		mounted && triggerVisible
		? createPortal(
				<div
					aria-hidden={!open}
					inert={!open}
					className={cn(
						"v3 pointer-events-none fixed left-0 top-0 z-50 size-0",
						overlayClassName,
					)}
				>
					<AnimatePresence
						initial={false}
						mode="popLayout"
						onExitComplete={() => setBackgroundScrollLocked(false)}
					>
						{open ? (
							<div
								key="morphing-search-overlay"
								className="fixed left-0 top-0 size-0"
							>
								<motion.button
									type="button"
									aria-label="Close search"
									data-v3-morph="catcher"
									className={cn(
										"pointer-events-auto fixed inset-0 z-0 cursor-default bg-transparent",
										scrim && "v3-morph-search__scrim",
									)}
									initial={scrim && !reduce ? { opacity: 0 } : false}
									animate={{ opacity: 1 }}
									exit={scrim && !reduce ? { opacity: 0 } : undefined}
									transition={{ duration: 0.2, ease: EASE_OUT }}
									onClick={closeSearch}
								/>

								<motion.div
									layoutId={shellLayoutId}
									aria-hidden="true"
									data-v3-morph="panel"
									className="pointer-events-none fixed z-10 rounded-xl bg-background backdrop-blur-xl"
									style={{
										top: anchorRect.top,
										left: panelLeft,
										width: panelWidth,
										height: 48 + resultsHeight + footerHeight,
										boxShadow: "inset 0 0 0 1px var(--color-border)",
										pointerEvents: "none",
									}}
									transition={morphTransition}
								/>

								<motion.div
									ref={dialogRef}
									role="dialog"
									aria-modal="true"
									aria-label="Search"
									onKeyDown={handleDialogKeyDown}
									initial={
										reduce || iconOnly
											? false
											: { opacity: 0, clipPath: collapsedContentClip }
									}
									animate={{
										opacity: 1,
										clipPath: expandedContentClip,
									}}
									exit={{
										opacity: 0,
										clipPath: iconOnly
											? expandedContentClip
											: collapsedContentClip,
										transition: reduce
											? { duration: 0 }
											: {
													clipPath: SEARCH_CLIP_TRANSITION,
													opacity: SEARCH_MORPH,
												},
									}}
									transition={
										reduce
											? { duration: 0 }
											: {
													clipPath: SEARCH_CLIP_TRANSITION,
													opacity: SEARCH_MORPH,
												}
									}
									data-v3-morph="dialog"
									className="pointer-events-auto isolate fixed z-20 overflow-hidden rounded-xl bg-background"
									style={{
										top: anchorRect.top,
										left: panelLeft,
										width: panelWidth,
										height: 48 + resultsHeight + footerHeight,
										backgroundColor: "var(--v3-cream)",
									}}
								>
									<div
										className={cn(
											"relative z-10 flex h-12 items-center gap-2.5 border-b border-border bg-background",
											iconOnly ? "px-4" : "px-3.5",
										)}
									>
										<span className="pointer-events-none shrink-0">
											<Search className="size-4 text-muted-foreground" />
										</span>
										<div className="relative z-10 flex h-10 min-w-0 flex-1 items-center">
											<input
												ref={inputRef}
												// Focus during React's commit of the tap that opened
												// the dialog, i.e. still inside the user gesture. The
												// requestAnimationFrame focus below runs a frame later,
												// which iOS treats as programmatic: no keyboard.
												autoFocus
												value={query}
												onChange={(event) => updateQuery(event.target.value)}
												role="combobox"
												aria-label={placeholder}
												aria-expanded="true"
												aria-controls={listboxId}
												aria-autocomplete="list"
												aria-activedescendant={
													filteredItems.length > 0
														? `${uid}-option-${activeIndex}`
														: undefined
												}
												placeholder={placeholder}
												data-v3-morph="input"
												className="relative z-10 size-full bg-background text-sm text-foreground outline-none placeholder:text-muted-foreground"
											/>
										</div>
										<kbd className="flex h-7 shrink-0 items-center rounded-md border border-border px-2 text-xs text-muted-foreground">
											Esc
										</kbd>
									</div>

									<div
										data-v3-morph="body"
										className={cn(
											"grid",
											showPreview &&
												"grid-cols-[minmax(0,1fr)_minmax(0,21rem)]",
										)}
										style={{ height: resultsHeight }}
									>
										<motion.div
											ref={listRef}
											id={listboxId}
											role="listbox"
											data-v3-morph="listbox"
											aria-label="Search results"
											transition={reduce ? { duration: 0 } : undefined}
											variants={
												reduce
													? undefined
													: {
															closed: {
																opacity: 0,
																transform: "translateY(6px)",
																transition: {
																	duration: 0.16,
																	delay: 0.18,
																	ease: EASE_OUT,
																},
															},
															open: {
																opacity: 1,
																transform: "translateY(0px)",
																transition: {
																	duration: 0.16,
																	ease: EASE_OUT,
																},
															},
														}
											}
											initial={
												reduce
													? { opacity: 1, transform: "translateY(0px)" }
													: "closed"
											}
											animate={
												reduce
													? { opacity: 1, transform: "translateY(0px)" }
													: "open"
											}
											exit={reduce ? undefined : "closed"}
											className="overscroll-contain overflow-y-auto p-2"
											style={{
												maxHeight: resultsHeight,
												minHeight: resultsHeight,
												backgroundColor: "var(--v3-cream)",
											}}
										>
											{filteredItems.length > 0 ? (
												groups.map((group, g) => {
													const rows = group.rows.map(({ item, index }) =>
														renderRow(item, index),
													);
													if (!group.name) {
														return <Fragment key={`${uid}-rows-${g}`}>{rows}</Fragment>;
													}
													const headId = `${uid}-group-${g}`;
													return (
														<div
															key={headId}
															role="group"
															aria-labelledby={headId}
															data-v3-morph="group"
														>
															<div
																id={headId}
																role="presentation"
																data-v3-morph="group-label"
																className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
															>
																{group.name}
															</div>
															{rows}
														</div>
													);
												})
											) : (
												<p className="px-3 py-8 text-center text-sm text-muted-foreground">
													{emptyMessage}
												</p>
											)}
										</motion.div>
										{showPreview ? (
											<div
												aria-hidden="true"
												data-v3-morph="preview"
												className="min-h-0 overflow-hidden border-l border-border"
												style={{ height: resultsHeight }}
											>
												{activeItem?.preview ? (
													<MorphingSearchPreviewPane
														key={activeItem.id}
														preview={activeItem.preview}
													/>
												) : null}
											</div>
										) : null}
									</div>
									{footer != null ? (
										<div
											data-v3-morph="footer"
											className="flex items-center gap-3 border-t border-border px-3.5"
											style={{ height: footerHeight }}
										>
											{footer}
										</div>
									) : null}
								</motion.div>
							</div>
						) : null}
					</AnimatePresence>
				</div>,
				document.body,
			)
		: null;

	return (
		<LayoutGroup id={uid}>
			<div
				ref={anchorRef}
				className={cn(
					"relative",
					iconOnly ? "size-12" : "h-12 w-72 max-w-full",
					className,
				)}
			>
				{!open ? (
					iconOnly ? (
						<motion.button
							ref={triggerRef}
							key="morphing-search-trigger"
							layoutId={shellLayoutId}
							type="button"
							aria-haspopup="dialog"
							aria-expanded="false"
							aria-label={placeholder}
							data-v3-morph="trigger"
							onClick={openSearch}
							transition={morphTransition}
							style={{
								boxShadow: "inset 0 0 0 1px var(--search-trigger-stroke)",
							}}
							className="flex size-full cursor-pointer items-center justify-center rounded-xl bg-background text-left backdrop-blur-md outline-none [--search-trigger-stroke:var(--color-border)] hover:[--search-trigger-stroke:var(--color-border-strong)] focus-visible:ring-2 focus-visible:ring-ring"
						></motion.button>
					) : (
						<motion.div
							key="morphing-search-trigger"
							layoutId={shellLayoutId}
							data-v3-morph="trigger"
							transition={morphTransition}
							style={{
								boxShadow: "inset 0 0 0 1px var(--search-trigger-stroke)",
							}}
							className="flex size-full items-center rounded-xl bg-background text-left backdrop-blur-md outline-none [--search-trigger-stroke:var(--color-border)] hover:[--search-trigger-stroke:var(--color-border-strong)] focus-within:ring-2 focus-within:ring-ring"
						>
							{/* Real typeable field at rest — closed button was not accepting input. */}
							{/* role="combobox": typing here opens the search dialog, and
							    aria-expanded / aria-haspopup are only allowed on an input
							    that says so (Lighthouse aria-allowed-attr, 2026-09-23). */}
							<input
								type="search"
								role="combobox"
								value={query}
								aria-label={placeholder}
								aria-haspopup="dialog"
								aria-expanded="false"
								placeholder={placeholder}
								autoComplete="off"
								className="size-full cursor-text bg-transparent py-0 pl-9 pr-14 text-sm text-foreground outline-none placeholder:text-muted-foreground"
								onFocus={openSearch}
								onChange={(event) => {
									updateQuery(event.target.value);
									openSearch();
								}}
							/>
						</motion.div>
					)
				) : null}
				<motion.div
					aria-hidden="true"
					initial={false}
					animate={{ opacity: open ? 0 : 1 }}
					transition={
						reduce
							? { duration: 0 }
							: {
									duration: 0.1,
									delay: open ? 0.1 : 0.12,
									ease: EASE_OUT,
								}
					}
					className={cn(
						"pointer-events-none absolute inset-0 flex items-center",
						backgroundScrollLocked && "z-[60]",
						iconOnly ? "justify-center" : "gap-2.5 px-3.5",
					)}
				>
					<Search className="size-4 shrink-0 text-muted-foreground" />
					{iconOnly ? null : (
						<>
							{/* Placeholder lives on the typeable input; keep shortcut only. */}
							<span className="min-w-0 flex-1" aria-hidden="true" />
							{shortcut ? (
								<kbd className="pointer-events-none flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md border border-border px-2 text-xs text-muted-foreground">
									{shortcut.toUpperCase()}
								</kbd>
							) : null}
						</>
					)}
				</motion.div>
			</div>
			{overlay}
		</LayoutGroup>
	);
}

/** The wide panel's preview of the row under the cursor (aria-hidden: the row carries its words). */
function MorphingSearchPreviewPane({
	preview,
}: {
	preview: MorphingSearchPreview;
}) {
	return (
		<div
			data-v3-morph="preview-card"
			className="flex h-full min-h-0 flex-col gap-3 p-3.5"
		>
			{preview.photo ? (
				// eslint-disable-next-line @next/next/no-img-element
				<img
					src={preview.photo}
					alt=""
					loading="eager"
					decoding="async"
					data-v3-morph="preview-photo"
					className="aspect-[4/3] w-full shrink-0 rounded-lg object-cover"
				/>
			) : null}
			<div className="min-w-0">
				{preview.eyebrow ? (
					<p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
						{preview.eyebrow}
					</p>
				) : null}
				<p
					data-v3-morph="preview-title"
					className="truncate text-lg font-medium text-foreground"
				>
					{preview.title}
				</p>
			</div>
			{preview.figures?.length ? (
				<dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
					{preview.figures.map((figure) => (
						<div key={figure.label} className="flex min-w-0 flex-col-reverse">
							<dt className="text-xs text-muted-foreground">{figure.label}</dt>
							<dd
								data-v3-morph="preview-figure"
								className="text-base font-semibold tabular-nums text-foreground"
							>
								{figure.value}
							</dd>
						</div>
					))}
				</dl>
			) : null}
			{preview.note ? (
				<p className="text-xs text-muted-foreground">{preview.note}</p>
			) : null}
			{preview.cta ? (
				<p className="mt-auto text-sm font-medium text-foreground underline underline-offset-4">
					{preview.cta}
				</p>
			) : null}
		</div>
	);
}
