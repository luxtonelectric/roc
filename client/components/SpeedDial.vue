<script setup lang="ts">

const props = defineProps({
    playerData: Object,
    selectedPhone: String
})

const emits = defineEmits({
    placeCall: String
})

watch(() => props.selectedPhone, async (newPhone, oldPhone) => {
    //console.log('WE GOT HERE |',newPhone,"|",oldPhone,"|");
    const phone = props.playerData?.phones.find(p => p.id === newPhone);
    //console.log('PHONE',phone.speedDial);
    selectedSpeedDial.value = phone.speedDial;
})

const selectedSpeedDial = ref();

</script>
<template>
Speed dial
    <template v-for="phone in selectedSpeedDial">
        <a class="button inline-block" @click="$emit('placeCall',phone.id)">{{phone.name}}</a>
    </template>
</template>