// @ts-check
export default class ClockData {
	/** @type {boolean} */
	isPaused;
	/** @type {number} */
	secondsSinceMidnight;
	/** @type {number} */
	lastReportedAt = Date.now();
	/** @type {number} */
	speed;

	/**
	 *
	 * @param {{area_id: string, clock: number, interval: number, paused: boolean}} simMsg
	 * @returns
	 */
	static fromSimMessage(simMsg) {
		const clockData = new ClockData();
		clockData.isPaused = simMsg.paused;
		// interval is how many ms between updates
		// SimSig does 2 updates per simulated second
		// so realtime is an interval of 500
		clockData.speed = 500 / simMsg.interval;
		clockData.speed = Math.min(clockData.speed, 32)
		clockData.secondsSinceMidnight = simMsg.clock;
		return clockData;
	}
}
