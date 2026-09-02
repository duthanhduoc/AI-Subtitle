export interface SubtitleCue {
	id?: string;
	startTime: number;
	endTime: number;
	text: string;
}
export interface SubtitleTrack {
	cues: SubtitleCue[];
}
