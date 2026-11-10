import chroma from "chroma-js";
import { button, type ElType, input, trackPoint, txt, view } from "dkh-ui";
import { t } from "../../../lib/translate/translate";
import { Class } from "../root/root";

const checkerboard =
    "conic-gradient(#ccc 25%, #fff 0 50%, #ccc 0 75%, #fff 0) 0 0 / 8px 8px";

function colorBackground(color: string) {
    return `linear-gradient(${color}, ${color}), ${checkerboard}`;
}

function parseColor(v: string) {
    if (!v.trim()) return chroma.rgb(0, 0, 0, 0);
    try {
        return chroma(v);
    } catch {
        return null;
    }
}

const clamp = (v: number, min = 0, max = 1) => Math.min(Math.max(v, min), max);

const defaultPresets = [
    "#000000",
    "#ffffff",
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#06b6d4",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "transparent",
];

export function colorPicker(
    opts: {
        width?: string;
        alpha?: boolean;
        presets?: string[] | false;
        /** 拖动时实时触发 input 事件 */
        live?: boolean;
        /** 直接展开取色区域，不使用弹出层 */
        inline?: boolean;
    } = {},
): ElType<HTMLDivElement> {
    const alphaEnabled = opts.alpha ?? true;
    const live = opts.live ?? false;
    const inline = opts.inline ?? false;

    let color = chroma.rgb(0, 0, 0, 0);
    let hue = 0;

    function normalizeColor(c: chroma.Color) {
        return alphaEnabled ? c : c.alpha(1);
    }

    function formatColor(c: chroma.Color) {
        return c.alpha() >= 1 ? c.hex("rgb") : c.hex("rgba");
    }

    function currentHsv() {
        const [h, s, v] = color.hsv();
        return {
            h: Number.isNaN(h) ? hue : h,
            s: Number.isNaN(s) ? 0 : s,
            v: Number.isNaN(v) ? 0 : v,
        };
    }

    const swatch = button()
        .style({
            width: "var(--b-button)",
            height: "var(--b-button)",
            flexShrink: 0,
            padding: 0,
            borderRadius: "var(--border-radius)",
        })
        .attr({ title: "颜色" })
        .on("click", () => togglePicker());

    const text = input()
        .style({
            flex: "1 1 0",
            width: "auto",
            minWidth: 0,
            fontFamily: "var(--monospace)",
        })
        .on("input", () => {
            const c = parseColor(text.gv);
            if (!c) return;
            color = normalizeColor(c);
            syncUI(false);
            dispatchInput();
        })
        .on("blur", () => text.sv(formatColor(color)))
        .on("keydown", (e) => {
            if (e.key === "Enter") {
                text.sv(formatColor(color));
                text.el.blur();
            }
        });

    const root = view("x")
        .class(Class.group)
        .style({ width: opts.width ?? "150px", minWidth: 0 })
        .add([swatch, text]);

    const svKnob = view().style({
        position: "absolute",
        width: "12px",
        height: "12px",
        borderRadius: "50%",
        border: "2px solid #fff",
        boxShadow: "0 0 0 1px #0008, 0 1px 2px #0006",
        boxSizing: "border-box",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
    });

    const sv = view()
        .style({
            position: "relative",
            width: "100%",
            height: "120px",
            borderRadius: "6px",
            cursor: "crosshair",
            touchAction: "none",
            overflow: "hidden",
        })
        .attr({ title: "饱和度与明度" })
        .add(svKnob);

    function updateSV(e: PointerEvent) {
        const rect = sv.el.getBoundingClientRect();
        const s = clamp((e.clientX - rect.left) / rect.width);
        const v = 1 - clamp((e.clientY - rect.top) / rect.height);
        color = chroma.hsv(hue, s, v, color.alpha());
        syncUI(true);
        if (live) dispatchInput();
    }

    const hueKnob = view().style({
        position: "absolute",
        top: "50%",
        width: "14px",
        height: "14px",
        borderRadius: "50%",
        background: "var(--bg)",
        border: "2px solid var(--font-color)",
        boxSizing: "border-box",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
    });

    const hueTrack = view()
        .style({
            position: "relative",
            width: "calc(100% - 14px)",
            margin: "0 7px",
            height: "12px",
            borderRadius: "6px",
            background:
                "linear-gradient(to right, #f00, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00)",
            cursor: "pointer",
            touchAction: "none",
        })
        .attr({ title: "色相" })
        .add(hueKnob);

    function updateHue(e: PointerEvent) {
        const rect = hueTrack.el.getBoundingClientRect();
        hue = clamp((e.clientX - rect.left) / rect.width) * 360;
        const hsv = currentHsv();
        color = chroma.hsv(hue, hsv.s, hsv.v, color.alpha());
        syncUI(true);
        if (live) dispatchInput();
    }

    const alphaKnob = view().style({
        position: "absolute",
        top: "50%",
        width: "14px",
        height: "14px",
        borderRadius: "50%",
        background: "var(--bg)",
        border: "2px solid var(--font-color)",
        boxSizing: "border-box",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
    });

    const alphaTrack = view()
        .style({
            position: "relative",
            width: "calc(100% - 14px)",
            margin: "0 7px",
            height: "12px",
            borderRadius: "6px",
            cursor: "pointer",
            touchAction: "none",
        })
        .attr({ title: "不透明度" })
        .add(alphaKnob);

    function updateAlpha(e: PointerEvent) {
        const rect = alphaTrack.el.getBoundingClientRect();
        const a = clamp((e.clientX - rect.left) / rect.width);
        color = color.alpha(a);
        syncUI(true);
        if (live) dispatchInput();
    }

    function trackSlider(
        target: ElType<HTMLDivElement>,
        update: (e: PointerEvent) => void,
    ) {
        target.on("pointerdown", update);
        trackPoint(target, {
            start: () => ({ x: 0, y: 0 }),
            ing: (_p, e) => update(e),
            end: () => dispatchInput(),
        });
    }

    trackSlider(sv, updateSV);
    trackSlider(hueTrack, updateHue);
    trackSlider(alphaTrack, updateAlpha);

    const presets = view("x", "wrap").style({ gap: "4px" });
    const presetBase = opts.presets ?? defaultPresets;
    const presetList = presetBase
        ? presetBase.filter(
              (preset) => alphaEnabled || preset !== "transparent",
          )
        : false;
    if (presetList) {
        for (const preset of presetList) {
            presets.add(
                button()
                    .style({
                        width: "18px",
                        height: "18px",
                        padding: 0,
                        borderRadius: "4px",
                        background: colorBackground(preset),
                    })
                    .data({
                        title: preset === "transparent" ? t("透明") : preset,
                    })
                    .on("click", () => {
                        const c = parseColor(preset);
                        if (!c) return;
                        color = normalizeColor(c);
                        syncUI(true, true);
                        dispatchInput();
                    }),
            );
        }
    }

    const valueText = txt()
        .class(Class.mono)
        .style({ fontSize: "0.85em", opacity: 0.8 });

    const pop = view("y")
        .class(Class.gap)
        .class(Class.deco)
        .style({
            position: "fixed",
            inset: "auto",
            margin: 0,
            padding: "var(--o-padding)",
            width: "232px",
            overflow: "hidden",
            background: "var(--bg)",
            color: "var(--font-color)",
            boxShadow: "var(--shadow)",
            visibility: "hidden",
        })
        .attr({ popover: "manual" })
        .add([sv, hueTrack, alphaTrack, presets, valueText]);
    if (inline) {
        root.clear().add([text, sv, hueTrack, alphaTrack, presets, valueText]);
        root.el.classList.remove(Class.group);
        root.style({
            "flex-flow": "column",
            alignItems: "stretch",
            height: "auto",
            width: "100%",
            outline: "none",
        });
        text.style({ width: "100%" });
    } else {
        root.add(pop);
    }

    if (!alphaEnabled) alphaTrack.style({ display: "none" });

    function syncUI(updateText: boolean, resetHue = false) {
        const hsv = currentHsv();
        hue = resetHue ? (Number.isNaN(color.hsv()[0]) ? 0 : hsv.h) : hsv.h;

        const css = formatColor(color);
        swatch.style({ background: colorBackground(css) });
        sv.style({
            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${chroma.hsv(hue, 1, 1).hex()})`,
        });
        svKnob.style({
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
        });
        hueKnob.style({ left: `${(hue / 360) * 100}%` });
        alphaKnob.style({ left: `${color.alpha() * 100}%` });
        alphaTrack.style({
            background: `linear-gradient(to right, transparent, ${color.alpha(1).hex()}), ${checkerboard}`,
        });
        valueText.sv(css);
        if (updateText) text.sv(css);
    }

    function dispatchInput() {
        root.el.dispatchEvent(new CustomEvent("input"));
    }

    function setValue(v: string, emit: boolean) {
        const c = parseColor(v);
        if (!c) {
            text.sv(v);
            return;
        }
        color = normalizeColor(c);
        syncUI(true, true);
        if (emit) dispatchInput();
    }

    function positionPopover() {
        if (!pop.el.matches(":popover-open")) return;
        const rect = root.el.getBoundingClientRect();
        const width = pop.el.offsetWidth;
        const height = pop.el.offsetHeight;
        const gap = 6;
        const margin = 4;
        const spaceBelow = window.innerHeight - rect.bottom;
        const left = clamp(
            rect.left,
            margin,
            Math.max(margin, window.innerWidth - width - margin),
        );
        const top =
            spaceBelow >= height + gap || rect.top - height - gap < margin
                ? rect.bottom + gap
                : rect.top - height - gap;
        pop.el.style.left = `${left}px`;
        pop.el.style.top = `${clamp(
            top,
            margin,
            Math.max(margin, window.innerHeight - height - margin),
        )}px`;
        pop.el.style.visibility = "visible";
    }

    function onOutsidePointerDown(e: PointerEvent) {
        const target = e.target as Node | null;
        if (!target) return;
        if (root.el.contains(target) || pop.el.contains(target)) return;
        closePicker();
    }

    function onKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") closePicker();
    }

    function cleanup() {
        document.removeEventListener("pointerdown", onOutsidePointerDown, true);
        document.removeEventListener("keydown", onKeyDown, true);
        window.removeEventListener("resize", positionPopover);
        document.removeEventListener("scroll", positionPopover, true);
    }

    function openPicker() {
        if (pop.el.matches(":popover-open")) return;
        pop.el.showPopover();
        positionPopover();
        document.addEventListener("pointerdown", onOutsidePointerDown, true);
        document.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("resize", positionPopover);
        document.addEventListener("scroll", positionPopover, true);
    }

    function closePicker() {
        if (pop.el.matches(":popover-open")) pop.el.hidePopover();
        pop.el.style.visibility = "hidden";
        cleanup();
    }

    function togglePicker() {
        if (pop.el.matches(":popover-open")) closePicker();
        else openPicker();
    }

    pop.el.addEventListener("toggle", () => {
        if (!pop.el.matches(":popover-open")) cleanup();
    });

    syncUI(true, true);

    return root
        .bindGet(() => formatColor(color))
        .bindSet((v: string) => setValue(v, false));
}
