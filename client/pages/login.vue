<!-- file: ~/pages/login.vue -->
<template>
    <div>
      <p>Sign-In Options:</p>
      <button @click="signIn('discord')">Discord</button>
    </div>
  </template>
  <script setup lang="ts">
  definePageMeta({
      auth: {
          unauthenticatedOnly: true,
          navigateAuthenticatedTo: '/',
      }
  })
  const { signIn } = useAuth()
  </script>