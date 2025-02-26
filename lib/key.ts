export { macKeyFomat, jsKey2ele, jsKeyCodeDisplay, ele2jsKeyCode };

const macKeyFomat = (k: string) => {
    const m = {
        "`": "`",
        "¡": "1",
        "™": "2",
        "£": "3",
        "¢": "4",
        "∞": "5",
        "§": "6",
        "¶": "7",
        "•": "8",
        ª: "9",
        º: "0",
        "–": "-",
        "≠": "=",
        "⁄": "1",
        "€": "2",
        "‹": "3",
        "›": "4",
        ﬁ: "5",
        ﬂ: "6",
        "‡": "7",
        "°": "8",
        "·": "9",
        "‚": "0",
        "—": "-",
        "±": "=",
        œ: "q",
        "∑": "w",
        "´": "e",
        "®": "r",
        "†": "t",
        "¥": "y",
        "¨": "u",
        ˆ: "i",
        ø: "o",
        π: "p",
        "“": "[",
        "‘": "]",
        "«": "\\",
        Œ: "q",
        "„": "w",
        "‰": "r",
        ˇ: "t",
        Á: "y",
        Ø: "o",
        "∏": "p",
        "”": "[",
        "’": "]",
        "»": "\\",
        å: "a",
        ß: "s",
        "∂": "d",
        ƒ: "f",
        "©": "g",
        "˙": "h",
        "∆": "j",
        "˚": "k",
        "¬": "l",
        "…": ";",
        æ: "'",
        Å: "a",
        Í: "s",
        Î: "d",
        Ï: "f",
        "˝": "g",
        Ó: "h",
        Ô: "j",
        "": "k",
        Ò: "l",
        Ú: ";",
        Æ: "'",
        Ω: "z",
        "≈": "x",
        ç: "c",
        "√": "v",
        "∫": "b",
        "˜": "n",
        µ: "m",
        "≤": ",",
        "≥": ".",
        "÷": "/",
        "¸": "z",
        "˛": "x",
        Ç: "c",
        "◊": "v",
        ı: "b",
        Â: "m",
        "¯": ",",
        "˘": ".",
        "¿": "/",
    };
    return m[k] || k;
};

const jsKey2ele = (k) => {
    const m = {
        ArrowUp: "Up",
        ArrowDown: "Down",
        ArrowLeft: "Left",
        ArrowRight: "Right",
        " ": "Space",
    };
    if (k.match(/[a-z]/) != null && k.length === 1) return k.toUpperCase();
    return m[k] || k;
};

const _map: {
    [k: string]: {
        primary?: string;
        secondary?: string;
        symble?: string;
        isRight?: boolean;
        isNumpad?: boolean;
    };
} = {
    Backspace: { symble: "⌫" },
    Tab: { symble: "⇥" },
    Enter: { symble: "⏎" },
    Shift: { symble: "⇧" },
    Control: { primary: "Ctrl", symble: "⌃" },
    Alt: { symble: "⌥" },
    Meta: { symble: "⊞" },
    Escape: { primary: "Esc", symble: "⎋" },
    CapsLock: { symble: "⇪" },
    Space: { symble: "␣" },

    ArrowLeft: { primary: "←" },
    ArrowUp: { primary: "↑" },
    ArrowRight: { primary: "→" },
    ArrowDown: { primary: "↓" },

    Semicolon: { primary: ";", secondary: ":" },
    Equal: { primary: "=", secondary: "+" },
    Comma: { primary: ",", secondary: "<" },
    Minus: { primary: "-", secondary: "_" },
    Period: { primary: ".", secondary: ">" },
    Slash: { primary: "/", secondary: "?" },
    Backquote: { primary: "`", secondary: "~" },
    BracketLeft: { primary: "[", secondary: "{" },
    Backslash: { primary: "\\", secondary: "|" },
    BracketRight: { primary: "]", secondary: "}" },
    Quote: { primary: '"', secondary: "'" },

    1: { secondary: "!" },
    2: { secondary: "@" },
    3: { secondary: "#" },
    4: { secondary: "$" },
    5: { secondary: "%" },
    6: { secondary: "^" },
    7: { secondary: "&" },
    8: { secondary: "*" },
    9: { secondary: "(" },
    0: { secondary: ")" },

    Multiply: { primary: "*" },
    Add: { primary: "+" },
    Subtract: { primary: "-" },
    Decimal: { primary: "." },
    Divide: { primary: "/" },
};

const map: {
    [k: string]: {
        primary: string;
        secondary?: string;
        symble?: string;
        isRight?: boolean;
        isNumpad?: boolean;
    };
} = {};

for (const [k, v] of Object.entries(_map)) {
    map[k] = {
        ...v,
        primary: v.primary || k,
    };
}

for (let i = 0; i < 25; i++) {
    const k = String.fromCharCode(65 + i);
    map[`Key${k}`] = { primary: k };
}

for (const k of ["ControlRight", "AltRight", "ShiftRight", "MetaRight"]) {
    const mainKey = k.replace("Right", "");
    map[k] = { ...map[mainKey] };
    map[k].isRight = true;
}
const numPad = [
    "Numpad0",
    "Numpad1",
    "Numpad2",
    "Numpad3",
    "Numpad4",
    "Numpad5",
    "Numpad6",
    "Numpad7",
    "Numpad8",
    "Numpad9",
    "NumpadMultiply",
    "NumpadAdd",
    "NumpadSubtract",
    "NumpadDecimal",
    "NumpadDivide",
    "NumpadEnd",
    "NumpadArrowDown",
    "NumpadPageDown",
    "NumpadArrowLeft",
    "NumpadArrowRight",
    "NumpadHome",
    "NumpadArrowUp",
    "NumpadPageUp",
    "NumpadInsert",
    "NumpadDelete",
];

for (const key of numPad) {
    const mainKey = key.replace("Numpad", "");
    map[key] = { primary: map[mainKey]?.primary ?? mainKey, isNumpad: true };
}

const macMap = {
    Control: { primary: "Control" },
    Alt: { primary: "Option" },
    Meta: { primary: "Command", symble: "⌘" },
    Enter: { primary: "Return" },
};

if (process.platform === "darwin")
    for (const k in macMap) {
        Object.assign(map[k], macMap[k]);
    }

const jsKeyCodeDisplay = (k: string) => {
    return map[k] || { primary: k };
};

const ele2jsKeyCode = (k: string) => {
    const m = {
        Up: "ArrowUp",
        Down: "ArrowDown",
        Left: "ArrowLeft",
        Right: "ArrowRight",
        numdec: "NumpadDecimal",
        numadd: "NumpadAdd",
        numsub: "NumpadSubtract",
        nummult: "NumpadMultiply",
        numdiv: "NumpadDivide",
        Command: "Meta",
        CommandOrControl: "Meta",
        CmdOrCtrl: "Meta",
        Option: "Alt",
    };
    for (let i = 0; i <= 9; i++) {
        m[`num${i}`] = `Numpad${i}`;
    }
    return m[k] || k;
};
