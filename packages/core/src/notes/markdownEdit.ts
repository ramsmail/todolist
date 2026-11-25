// Pure markdown toolbar transforms over text + selection. Platform-neutral.

export interface TextEdit {
  text: string;
  selStart: number;
  selEnd: number;
}

export function toggleInline(edit: TextEdit, marker: string): TextEdit {
  const { text, selStart, selEnd } = edit;
  const m = marker.length;
  const before = text.slice(selStart - m, selStart);
  const after = text.slice(selEnd, selEnd + m);
  if (selEnd > selStart && before === marker && after === marker) {
    return {
      text: text.slice(0, selStart - m) + text.slice(selStart, selEnd) + text.slice(selEnd + m),
      selStart: selStart - m,
      selEnd: selEnd - m,
    };
  }
  return {
    text: text.slice(0, selStart) + marker + text.slice(selStart, selEnd) + marker + text.slice(selEnd),
    selStart: selStart + m,
    selEnd: selEnd + m,
  };
}

const HEADING = /^#{1,6} /;

export function toggleLinePrefix(edit: TextEdit, prefix: string): TextEdit {
  const { text, selStart, selEnd } = edit;
  const lineStart = text.lastIndexOf('\n', selStart - 1) + 1;
  const nl = text.indexOf('\n', Math.max(selEnd - 1, selStart));
  const lineEnd = selEnd > selStart && text[selEnd - 1] === '\n' ? selEnd - 1 : nl === -1 ? text.length : nl;
  const block = text.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const isHeading = HEADING.test(prefix);

  const allHave = lines.every((l) => l.startsWith(prefix));
  let delta0 = 0;
  const out = lines.map((l, i) => {
    let next: string;
    if (allHave) {
      next = l.slice(prefix.length);
    } else if (isHeading && HEADING.test(l)) {
      next = l.replace(HEADING, prefix);
    } else {
      next = prefix + l;
    }
    if (i === 0) delta0 = next.length - l.length;
    return next;
  });
  const newBlock = out.join('\n');
  const totalDelta = newBlock.length - block.length;
  const newText = text.slice(0, lineStart) + newBlock + text.slice(lineEnd);

  if (selStart === selEnd) {
    const pos = Math.max(lineStart, selStart + delta0);
    return { text: newText, selStart: pos, selEnd: pos };
  }
  return { text: newText, selStart: lineStart, selEnd: lineEnd + totalDelta };
}

export function insertLink(edit: TextEdit): TextEdit {
  const { text, selStart, selEnd } = edit;
  const label = selEnd > selStart ? text.slice(selStart, selEnd) : 'text';
  const inserted = `[${label}](url)`;
  const urlStart = selStart + label.length + 3; // "[" + label + "]("
  return {
    text: text.slice(0, selStart) + inserted + text.slice(selEnd),
    selStart: urlStart,
    selEnd: urlStart + 3,
  };
}
