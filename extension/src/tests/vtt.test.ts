import { describe, expect, it } from 'vitest';
import { applyCaptionStyle, captionBackground, type CaptionStyle } from '../subtitles/vtt';

const style: CaptionStyle = {
	fontFamily: 'Arial',
	color: '#ffffff',
	fontSize: '150%',
	background: '#0000ff',
	backgroundOpacity: '0.75'
};

describe('VTT caption styling', () => {
	it('resolves color and opacity for the native cue renderer', () => {
		expect(captionBackground({ background: '#0000ff', backgroundOpacity: '0.5' })).toBe('rgba(0, 0, 255, 0.5)');
		expect(captionBackground({ background: 'transparent', backgroundOpacity: '1' })).toBe('transparent');
		expect(captionBackground({ background: 'system', backgroundOpacity: 'system' })).toBeUndefined();
	});

	it('inserts one extension stylesheet after the VTT header', () => {
		const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello\n';
		const styled = applyCaptionStyle(vtt, style);
		expect(styled).toContain('/* Extension captions */\n::cue {\n  color: #ffffff;');
		expect(styled).toContain('background-image: linear-gradient(rgba(0, 0, 255, 0.75), rgba(0, 0, 255, 0.75));');
		expect(styled).not.toContain('background-color:');
	});

	it('does not inject a font size for the system default', () => {
		const styled = applyCaptionStyle('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello\n', { color: '#ffeb3b', fontSize: 'system' });
		expect(styled).toContain('color: #ffeb3b;');
		expect(styled).not.toContain('font-size:');
	});

	it('uses the stable 70% VTT size for the 75% menu option', () => {
		const styled = applyCaptionStyle('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello\n', { fontSize: '70%' });
		expect(styled).toContain('font-size: 70%;');
	});

	it('applies the 100% font-size default', () => {
		const styled = applyCaptionStyle('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello\n', { fontSize: '100%' });
		expect(styled).toContain('font-size: 100%;');
	});

	it('removes only the extension stylesheet when reset to default', () => {
		const vtt = 'WEBVTT\n\nSTYLE\n::cue { color: red; }\n\n00:00:01.000 --> 00:00:02.000\nHello\n';
		const styled = applyCaptionStyle(vtt, style);
		const restored = applyCaptionStyle(styled, undefined);
		expect(restored).toContain('::cue { color: red; }');
		expect(restored).not.toContain('Extension captions');
	});
});
