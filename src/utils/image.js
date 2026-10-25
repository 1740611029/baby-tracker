// 备忘一次最多 9 张图，全部 base64 存在同一行里，D1 单行上限 2MB。
// 所以备忘用更小的档位，把单张稳定压到 160KB 以内（9 张约 1MB，留足余量）。
export const MEMO_IMG = { maxSide: 1024, quality: 0.65, maxB64: 160 * 1024 }

const DEFAULT_IMG = { maxSide: 1280, quality: 0.7, maxB64: 220 * 1024 }

function drawToJpeg(img, maxSide, quality) {
  let { width: w, height: h } = img
  const scale = Math.min(1, maxSide / Math.max(w, h))
  w = Math.round(w * scale)
  h = Math.round(h * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  // PNG 的透明区域转 JPEG 会变黑，先铺一层白
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

// 目标体积压缩：先降 quality，降到 0.4 仍超标就缩尺寸，最多迭代 6 次。
// 单张体积可控，才不会让「保存」变成一个几 MB 的请求。
export function compressImage(file, maxSide = DEFAULT_IMG.maxSide, quality = DEFAULT_IMG.quality, maxB64 = DEFAULT_IMG.maxB64) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let side = maxSide
        let q = quality
        let out = ''
        for (let i = 0; i < 6; i++) {
          out = drawToJpeg(img, side, q)
          if (out.length <= maxB64) break
          if (q > 0.42) q = Math.max(0.4, q - 0.1)
          else side = Math.round(side * 0.8)
        }
        resolve(out)
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function pickImages(multiple = false, opts = {}) {
  const { maxSide = DEFAULT_IMG.maxSide, quality = DEFAULT_IMG.quality, maxB64 = DEFAULT_IMG.maxB64 } = opts
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = multiple
    input.onchange = async () => {
      const out = []
      for (const file of input.files) out.push(await compressImage(file, maxSide, quality, maxB64))
      resolve(out)
    }
    input.oncancel = () => resolve([])
    input.click()
  })
}
