export function compressImage(file, maxSide = 1280, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let { width: w, height: h } = img
        const scale = Math.min(1, maxSide / Math.max(w, h))
        w = Math.round(w * scale)
        h = Math.round(h * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function pickImages(multiple = false) {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = multiple
    input.onchange = async () => {
      const out = []
      for (const file of input.files) out.push(await compressImage(file))
      resolve(out)
    }
    input.oncancel = () => resolve([])
    input.click()
  })
}
