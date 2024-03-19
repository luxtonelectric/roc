<script setup lang="ts">

const props = defineProps({
    playerData: Object,
    selectedPhone: String
})

const emits = defineEmits({
    placeCall: String
})

const selectedSpeedDial = ref({});

watch(() => props.selectedPhone, async (newPhone) => {
    const phone = props.playerData?.phones.find(p => p.id === newPhone);
    selectedSpeedDial.value = phone.speedDial;
},{immediate: true})



</script>
<template>
    <h1 class="text-3xl font-semibold ">Speed dial</h1>
    <div>
        <template v-for="phone in selectedSpeedDial">
            <a class="button inline-block" @click="$emit('placeCall',phone.id)">{{phone.name}}</a>
        </template>
    </div>
</template>