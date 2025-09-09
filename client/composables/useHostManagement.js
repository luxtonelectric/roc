import { ref } from 'vue'

export function useHostManagement(socket, showError, showSuccess) {
  const formMode = ref('add')
  const selectedHostId = ref(null)
  const newHost = ref({
    sim: "",
    host: "",
    port: "",
    channel: "",
    interfaceGateway: {
      port: 51515,
      enabled: true,
      username: "",
      password: "",
      hasPassword: false
    }
  })
  const passwordConfirmation = ref("")

  const validatePortInput = (event) => {
    // Only allow numeric input for port fields
    const value = event.target.value
    
    // Remove any non-numeric characters
    const numericValue = value.replace(/[^0-9]/g, '')
    
    // Convert to number and validate range
    const portNumber = parseInt(numericValue)
    
    if (numericValue !== value) {
      // Update the input with cleaned value
      event.target.value = numericValue
      newHost.value.interfaceGateway.port = portNumber || ''
    } else if (portNumber) {
      // Ensure the port is within valid range
      if (portNumber < 1 || portNumber > 65535) {
        // If outside range, reset to a valid port
        if (portNumber > 65535) {
          newHost.value.interfaceGateway.port = 65535
        } else if (portNumber < 1) {
          newHost.value.interfaceGateway.port = 1
        }
      }
    }
  }

  const submitHostForm = () => {
    // Validate passwords if provided
    if (newHost.value.interfaceGateway.password) {
      if (newHost.value.interfaceGateway.password !== passwordConfirmation.value) {
        showError('Validation Error', 'Passwords do not match')
        return
      }
      if (newHost.value.interfaceGateway.password.length < 6) {
        showError('Validation Error', 'Password must be at least 6 characters long')
        return
      }
    }

    // Prepare host data
    const hostData = { ...newHost.value }
    
    // Only include authentication if username is provided
    if (!hostData.interfaceGateway.username) {
      // Clear authentication fields if no username
      delete hostData.interfaceGateway.username
      delete hostData.interfaceGateway.password
    } else if (!hostData.interfaceGateway.password && formMode.value === 'edit') {
      // For edit mode, if no password provided, don't include it (keep existing)
      delete hostData.interfaceGateway.password
    }

    if (formMode.value === 'add') {
      socket.emit("addHost", hostData, (response) => {
        if (response.success) {
          showSuccess('Host Added', `Successfully added host for simulation '${hostData.sim}'`)
          resetForm()
        } else {
          showError('Failed to Add Host', response.error)
        }
      })
    } else {
      socket.emit("updateHost", { ...hostData, originalSimId: selectedHostId.value }, (response) => {
        if (response.success) {
          showSuccess('Host Updated', `Successfully updated host for simulation '${hostData.sim}'`)
          resetForm()
        } else {
          showError('Failed to Update Host', response.error)
        }
      })
    }
  }

  const editHost = (host, availableSimulations) => {
    // Make sure the simulation is available
    if (!availableSimulations.some(sim => sim.id === host.sim)) {
      availableSimulations.push({
        id: host.sim,
        name: host.sim // Fallback in case we don't have the name
      })
    }
    formMode.value = 'edit'
    selectedHostId.value = host.sim
    newHost.value = {
      sim: host.sim,
      host: host.host,
      port: host.port,
      channel: host.channel,
      interfaceGateway: {
        port: host.interfaceGateway.port,
        enabled: host.interfaceGateway.enabled,
        username: host.interfaceGateway.username || "",
        password: "", // Never populate password field for security
        hasPassword: host.interfaceGateway.hasPassword || false
      }
    }
    passwordConfirmation.value = ""
  }

  const cancelEdit = () => {
    resetForm()
  }

  const confirmDelete = (host) => {
    if (confirm(`Are you sure you want to delete the host for ${host.sim}?`)) {
      socket.emit("deleteHost", { simId: host.sim }, (response) => {
        if (response.success) {
          showSuccess('Host Deleted', `Successfully deleted host for simulation '${host.sim}'`)
        } else {
          showError('Failed to Delete Host', response.error)
        }
      })
    }
  }

  const resetForm = () => {
    formMode.value = 'add'
    selectedHostId.value = null
    newHost.value = {
      sim: "",
      host: "",
      port: "",
      channel: "",
      interfaceGateway: {
        port: 51515,
        enabled: true,
        username: "",
        password: "",
        hasPassword: false
      }
    }
    passwordConfirmation.value = ""
  }

  const toggleHost = (host) => {
    if (host.enabled) {
      socket.emit("disableHost", { simId: host.sim })
    } else {
      socket.emit("enableHost", { simId: host.sim })
    }
  }

  const enableIG = (simId) => {
    console.log('enableIG', simId)
    socket.emit("enableInterfaceGateway", { "simId": simId }, (response) => {
      if (!response.success) {
        showError('Interface Gateway Error', `Failed to enable Interface Gateway: ${response.error}`)
      }
    })
  }

  const disableIG = (simId) => {
    console.log('disableIG', simId)
    socket.emit("disableInterfaceGateway", { "simId": simId }, (response) => {
      if (!response.success) {
        showError('Interface Gateway Error', `Failed to disable Interface Gateway: ${response.error}`)
      }
    })
  }

  return {
    formMode,
    selectedHostId,
    newHost,
    passwordConfirmation,
    validatePortInput,
    submitHostForm,
    editHost,
    cancelEdit,
    confirmDelete,
    resetForm,
    toggleHost,
    enableIG,
    disableIG
  }
}
