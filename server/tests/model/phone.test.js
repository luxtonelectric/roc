import Player from '../../src/model/player';
import Phone from '../../src/model/phone';

const player = new Player(null,'discordID','');
const phone = new Phone('id','name',Phone.TYPES.FIXED);
phone.setPlayer(player);

const phoneNoPlayer = new Phone('id','name',Phone.TYPES.FIXED);

test('getDiscordId', () => {
  expect(phone.getDiscordId()).toBe('discordID');
  expect(phoneNoPlayer.getDiscordId()).toBe(null);
})

test('check isType',() => {
  expect(phone.isType(Phone.TYPES.FIXED)).toBe(true)
  expect(phone.isType(Phone.TYPES.MOBILE)).toBe(false)
  expect(phone.isType(Phone.TYPES.TRAIN)).toBe(false)
  expect(phone.isType('random string')).toBe(false)
})