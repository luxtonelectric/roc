import { ref } from 'vue'

export function useNotifications() {
  const notification = ref({
    show: false,
    type: 'error', // 'error' or 'success'
    title: '',
    message: ''
  })

  let timeoutId = null

  const showNotification = (type, title, message) => {
    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    notification.value = {
      show: true,
      type: type,
      title: title,
      message: message
    }
    
    // Auto-hide after 5 seconds
    timeoutId = setTimeout(() => {
      hideNotification()
    }, 5000)
  }

  const hideNotification = () => {
    notification.value.show = false
  }

  const showError = (title, message) => {
    showNotification('error', title, message)
  }

  const showSuccess = (title, message) => {
    showNotification('success', title, message)
  }

  // Cleanup function for component unmount
  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }

  return {
    notification,
    showNotification,
    hideNotification,
    showError,
    showSuccess,
    cleanup
  }
}
