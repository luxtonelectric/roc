<template>
  <div 
    v-if="isVisible" 
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
    @click.self="handleBackgroundClick"
  >
    <div class="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="bg-indigo-600 text-white p-6 rounded-t-lg">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold">Add New Phone</h1>
          <button 
            @click="closeModal"
            class="text-white hover:text-gray-200 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-indigo-700 transition-colors"
          >
            ×
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="p-6">
        <form @submit.prevent="handleSubmit">
          <div class="grid grid-cols-1 gap-4">
            <div>
              <label for="modal_phone_name" class="block text-sm font-medium text-gray-700">Name</label>
              <input 
                v-model="localNewPhone.name" 
                id="modal_phone_name" 
                type="text" 
                placeholder="Phone name"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
            <div>
              <label for="modal_phone_number" class="block text-sm font-medium text-gray-700">Number</label>
              <input 
                v-model="localNewPhone.number" 
                id="modal_phone_number" 
                type="number" 
                min="1" 
                step="1"
                pattern="[0-9]+" 
                title="Phone number (numbers only)" 
                placeholder="Phone number"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                @input="handleValidatePhoneNumberInput"
                required
              />
            </div>
            <div>
              <label for="modal_phone_type" class="block text-sm font-medium text-gray-700">Type</label>
              <select 
                v-model="localNewPhone.type" 
                id="modal_phone_type"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="mobile">Mobile</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
            <button 
              type="button" 
              @click="closeModal" 
              class="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              class="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Create Phone
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue'

export default {
  name: 'AddPhoneModal',
  props: {
    isVisible: {
      type: Boolean,
      default: false
    },
    validatePhoneNumberInput: {
      type: Function,
      required: true
    }
  },
  emits: ['close', 'submit'],
  setup(props, { emit }) {
    // Create local reactive copy of the newPhone prop, initialized only once
    const localNewPhone = ref({
      name: "",
      number: "",
      type: "mobile"
    })

    // Reset form when modal becomes visible
    watch(() => props.isVisible, (isVisible) => {
      if (isVisible) {
        localNewPhone.value = {
          name: "",
          number: "",
          type: "mobile"
        }
      }
    })

    return {
      localNewPhone
    }
  },
  methods: {
    closeModal() {
      this.$emit('close')
    },
    handleBackgroundClick() {
      this.closeModal()
    },
    handleValidatePhoneNumberInput(event) {
      this.validatePhoneNumberInput(event)
    },
    handleSubmit() {
      // Emit the form data for the parent to handle
      this.$emit('submit', { ...this.localNewPhone })
    }
  }
}
</script>

<style scoped>
/* Custom scrollbar for modal content */
.max-h-\[90vh\]::-webkit-scrollbar {
  width: 6px;
}

.max-h-\[90vh\]::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.max-h-\[90vh\]::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.max-h-\[90vh\]::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
