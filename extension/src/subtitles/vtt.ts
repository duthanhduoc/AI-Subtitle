type CaptionColor = '#ffffff' | '#ffeb3b' | '#00ff00' | '#00e5ff' | '#0000ff' | '#ff00ff' | '#ff0000' | '#000000';

export type CaptionStyle = {
	fontFamily: 'Arial' | 'Georgia' | 'monospace';
	color: CaptionColor;
	fontSize: 'system' | '50%' | '70%' | '100%' | '150%';
	background: 'system' | CaptionColor | 'transparent';
	backgroundOpacity: 'system' | '0' | '0.5' | '0.75' | '1';
};

const extensionStyle = /^STYLE\n\/\* Extension captions \*\/[\s\S]*?(?:\n{2}|$)/m;

const rgbChannels: Record<CaptionColor, string> = {
	'#ffffff': '255, 255, 255',
	'#ffeb3b': '255, 235, 59',
	'#00ff00': '0, 255, 0',
	'#00e5ff': '0, 229, 255',
	'#0000ff': '0, 0, 255',
	'#ff00ff': '255, 0, 255',
	'#ff0000': '255, 0, 0',
	'#000000': '0, 0, 0'
};

export const captionBackground = (style: Partial<Pick<CaptionStyle, 'background' | 'backgroundOpacity'>>): string | undefined => {
	const background = style.background;
	const opacity = style.backgroundOpacity;
	if ((!background || background === 'system') && (!opacity || opacity === 'system')) return undefined;
	const color = !background || background === 'system' ? '#000000' : background;
	return color === 'transparent' ? 'transparent' : `rgba(${rgbChannels[color]}, ${!opacity || opacity === 'system' ? '0.75' : opacity})`;
};

export const applyCaptionStyle = (vtt: string, style: Partial<CaptionStyle> | undefined): string => {
	const source = vtt.replace(extensionStyle, '');
	if (!style) return source;

	const declarations: string[] = [];
	if (style.color) declarations.push(`  color: ${style.color};`);
	if (style.fontFamily) declarations.push(`  font-family: ${style.fontFamily};`);
	// `system` giữ nguyên cỡ chữ do trình duyệt và cài đặt Trợ năng quyết định.
	if (style.fontSize && style.fontSize !== 'system') declarations.push(`  font-size: ${style.fontSize};`);
	const background = captionBackground(style);
	if (background) {
		declarations.push(`  background-image: linear-gradient(${background}, ${background});`);
	}
	if (declarations.length === 0) return source;

	const styleBlock = `STYLE\n/* Extension captions */\n::cue {\n${declarations.join('\n')}\n}\n\n`;
	const headerEnd = source.indexOf('\n\n');
	if (headerEnd < 0) return `${source.trimEnd()}\n\n${styleBlock}`;
	return `${source.slice(0, headerEnd + 2)}${styleBlock}${source.slice(headerEnd + 2)}`;
};
