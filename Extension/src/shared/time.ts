// Timestamp của player bỏ phần giờ cho đến khi cần, phù hợp UI media player
// phổ biến và vẫn an toàn với duration không hợp lệ/live.
export function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
	const total = Math.floor(seconds);
	const h = Math.floor(total / 3600);
	const m = Math.floor(total / 60) % 60;
	const s = total % 60;
	return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
