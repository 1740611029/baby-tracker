import { reactive } from 'vue'

export const ui = reactive({
  toast: '',
  loading: false,
  confirm: null,
  _toastTimer: null,
  _confirmResolve: null
})

export function showToast(msg, ms = 1800) {
  ui.toast = msg
  clearTimeout(ui._toastTimer)
  ui._toastTimer = setTimeout(() => { ui.toast = '' }, ms)
}

export function showLoading() { ui.loading = true }
export function hideLoading() { ui.loading = false }

export function showConfirm(opts) {
  return new Promise(resolve => {
    ui.confirm = typeof opts === 'string' ? { title: opts } : opts
    ui._confirmResolve = resolve
  })
}

export function resolveConfirm(val) {
  ui._confirmResolve?.(val)
  ui.confirm = null
  ui._confirmResolve = null
}
