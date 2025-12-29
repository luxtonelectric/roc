export function createIoMock() {
  const events = [];
  return {
    events,
    to: (discordId) => ({
      emit: (ev, data) => events.push({ to: discordId, ev, data })
    }),
    emit: (ev, data) => events.push({ to: '*', ev, data })
  };
}
