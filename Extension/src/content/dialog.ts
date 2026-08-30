import { parseSrt } from '../subtitles/srt'
import Hls from 'hls.js'

console.log('dialog.ts loaded')

const dialogId = 'custom-pip-video-dialog'

function toWebVtt(text: string): string {
  const track = parseSrt(text)
  return [
    'WEBVTT',
    '',
    ...track.cues.flatMap((cue) => [
      `${cue.startTime.toFixed(3)} --> ${cue.endTime.toFixed(3)}`,
      cue.text,
      ''
    ])
  ].join('\n')
}

const isHls = (url: string) => /\.m3u8(?:$|[?#])/i.test(url)

export async function openVideoDialog(
  url: string,
  initialSubtitle?: string,
  initialSubtitleName?: string
): Promise<void> {
  const previous = document.getElementById(dialogId) as HTMLDialogElement | null
  if (previous) {
    if (!previous.open) previous.showModal()
    return
  }

  const dialog = document.createElement('dialog')
  dialog.id = dialogId
  dialog.setAttribute('aria-label', 'Custom video player')
  dialog.style.cssText =
    'padding:0;border:0;background:transparent;max-width:none;max-height:none;overflow:visible;'
  const dialogStyle = document.createElement('style')
  dialogStyle.dataset.customPipDialog = 'true'
  dialogStyle.textContent = `
    dialog#${dialogId} { margin: auto !important; }
    dialog#${dialogId}::backdrop { background: rgba(0, 0, 0, .72) !important; }
  `
  document.head.append(dialogStyle)
  const host = document.createElement('div')
  host.className = 'custom-pip-dialog-host'
  dialog.append(host)
  const style = document.createElement('style')
  const scope = `#${dialogId} .${host.className}`
  style.textContent = `
    ${scope} { all: initial; display: block; }
    ${scope} .shell { width: min(92vw, 960px); color: white; background: #111; border-radius: 10px; overflow: hidden; }
    ${scope} .header { display: flex; align-items: center; justify-content: flex-end; height: 34px; padding: 0 8px; background: #181818; }
    ${scope} .close { border: 0; color: white; background: transparent; font-size: 24px; line-height: 1; cursor: pointer; }
    ${scope} .close:hover { color: #f87171; }
    ${scope} .video-wrap { position: relative; width: min(92vw, 960px); aspect-ratio: 16 / 9; background: #000; }
    ${scope} .video-wrap video-player, ${scope} .video-wrap video-skin, ${scope} .video-wrap hlsjs-video { display: block; width: 100%; height: 100%; }
    ${scope} .tools { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #181818; font: 13px system-ui, sans-serif; }
    ${scope} .tools label { cursor: pointer; }
    ${scope} .tools input { max-width: 180px; }
    ${scope} .error { padding: 8px 10px; color: #fca5a5; font: 13px system-ui, sans-serif; }
    @media (max-width: 560px) { ${scope} .tools { flex-wrap: wrap; } }
  `
  host.append(style)

  const shell = document.createElement('section')
  shell.className = 'shell'
  const header = document.createElement('header')
  header.className = 'header'
  const close = document.createElement('button')
  close.className = 'close'
  close.type = 'button'
  close.textContent = '×'
  close.setAttribute('aria-label', 'Close video dialog')
  header.append(close)
  const videoWrap = document.createElement('div')
  videoWrap.className = 'video-wrap'
  const player = document.createElement('video-player')
  const skin = document.createElement('video-skin')
  let media: HTMLElement
  if (isHls(url)) {
    const nativeMedia = document.createElement('video')
    nativeMedia.crossOrigin = 'anonymous'
    if (Hls.isSupported()) {
      // Keep HLS out of the page's MAIN-world hls.js instance.
      const hls = new Hls({ enableWorker: false })
      hls.loadSource(url)
      hls.attachMedia(nativeMedia)
    } else nativeMedia.src = url
    media = nativeMedia
  } else {
    const nativeMedia = document.createElement('video')
    nativeMedia.crossOrigin = 'anonymous'
    nativeMedia.src = url
    media = nativeMedia
  }
  const nativeVideo = media as HTMLVideoElement
  nativeVideo.defaultMuted = false
  nativeVideo.muted = false
  nativeVideo.volume = 1
  media.setAttribute('playsinline', '')
  media.setAttribute('preload', 'auto')
  skin.append(media)
  player.append(skin)
  videoWrap.append(player)
  const tools = document.createElement('div')
  tools.className = 'tools'
  const label = document.createElement('label')
  label.textContent = 'SRT '
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.srt,text/plain'
  label.append(input)
  tools.append(label)
  const error = document.createElement('div')
  error.className = 'error'
  error.hidden = true
  shell.append(header, videoWrap, tools, error)
  host.append(shell)
  document.body.append(dialog)

  const addSubtitle = (text: string, name: string) => {
    const source = URL.createObjectURL(
      new Blob([toWebVtt(text)], { type: 'text/vtt' })
    )
    const track = document.createElement('track')
    track.kind = 'subtitles'
    track.label = name
    track.srclang = 'und'
    track.src = source
    track.default = true
    media.append(track)
  }
  if (initialSubtitle)
    addSubtitle(initialSubtitle, initialSubtitleName ?? 'Subtitle')
  input.onchange = async () => {
    const file = input.files?.[0]
    if (file) addSubtitle(await file.text(), file.name)
  }
  media.addEventListener('error', (event) => {
    const detail = (event as unknown as CustomEvent<{ message?: string }>)
      .detail
    const message =
      detail?.message ??
      (media as HTMLVideoElement).error?.message ??
      'Could not play this video.'
    error.textContent = message
    error.hidden = false
  })

  close.onclick = () => dialog.close()
  dialog.addEventListener('close', () => nativeVideo.pause())
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault()
    dialog.close()
  })
  dialog.showModal()
}
