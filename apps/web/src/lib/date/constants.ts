/**
 * @module constants
 * @summary Useful constants
 * @description
 * Collection of useful date constants.
 *
 * The constants could be imported from `date-fns/constants`:
 *
 * ```ts
 * import { maxTime, minTime } from "date-fns/constants";
 *
 * function isAllowedTime(time) {
 *   return time <= maxTime && time >= minTime;
 * }
 * ```
 */

/**
 * @constant
 * @name DAYS_IN_WEEK
 * @summary Days in 1 week.
 */
export const DAYS_IN_WEEK = 7;

/**
 * @constant
 * @name DAYS_IN_YEAR
 * @summary Days in 1 year.
 *
 * @description
 * How many days in a year.
 *
 * One years equals 365.2425 days according to the formula:
 *
 * > Leap year occurs every 4 years, except for years that are divisible by 100 and not divisible by 400.
 * > 1 mean year = (365+1/4-1/100+1/400) days = 365.2425 days
 */
export const DAYS_IN_YEAR = 365.2425;

/**
 * @constant
 * @name MAX_TIME
 * @summary Maximum allowed time.
 *
 * @example
 * import { MAX_TIME } from "date-fns/constants";
 *
 * const isValid = 8640000000000001 <= MAX_TIME;
 * //=> false
 *
 * new Date(8640000000000001);
 * //=> Invalid Date
 */
export const MAX_TIME = Math.pow(10, 8) * 24 * 60 * 60 * 1000;

/**
 * @constant
 * @name MIN_TIME
 * @summary Minimum allowed time.
 *
 * @example
 * import { MIN_TIME } from "date-fns/constants";
 *
 * const isValid = -8640000000000001 >= MIN_TIME;
 * //=> false
 *
 * new Date(-8640000000000001)
 * //=> Invalid Date
 */
export const MIN_TIME = -MAX_TIME;

/**
 * @constant
 * @name MILLISECONDS_IN_WEEK
 * @summary Milliseconds in 1 week.
 */
export const MILLISECONDS_IN_WEEK = 604800000;

/**
 * @constant
 * @name MILLISECONDS_IN_DAY
 * @summary Milliseconds in 1 day.
 */
export const MILLISECONDS_IN_DAY = 86400000;

/**
 * @constant
 * @name MILLISECONDS_IN_MINUTE
 * @summary Milliseconds in 1 minute
 */
export const MILLISECONDS_IN_MINUTE = 60000;

/**
 * @constant
 * @name MILLISECONDS_IN_HOUR
 * @summary Milliseconds in 1 hour
 */
export const MILLISECONDS_IN_HOUR = 3600000;

/**
 * @constant
 * @name MILLISECONDS_IN_SECOND
 * @summary Milliseconds in 1 second
 */
export const MILLISECONDS_IN_SECOND = 1000;

/**
 * @constant
 * @name MINUTES_IN_YEAR
 * @summary Minutes in 1 year.
 */
export const MINUTES_IN_YEAR = 525600;

/**
 * @constant
 * @name MINUTES_IN_MONTH
 * @summary Minutes in 1 month.
 */
export const MINUTES_IN_MONTH = 43200;

/**
 * @constant
 * @name MINUTES_IN_DAY
 * @summary Minutes in 1 day.
 */
export const MINUTES_IN_DAY = 1440;

/**
 * @constant
 * @name MINUTES_IN_HOUR
 * @summary Minutes in 1 hour.
 */
export const MINUTES_IN_HOUR = 60;

/**
 * @constant
 * @name MONTHS_IN_QUARTER
 * @summary Months in 1 quarter.
 */
export const MONTHS_IN_QUARTER = 3;

/**
 * @constant
 * @name MONTHS_IN_YEAR
 * @summary Months in 1 year.
 */
export const MONTHS_IN_YEAR = 12;

/**
 * @constant
 * @name QUARTERS_IN_YEAR
 * @summary Quarters in 1 year
 */
export const QUARTERS_IN_YEAR = 4;

/**
 * @constant
 * @name SECONDS_IN_HOUR
 * @summary Seconds in 1 hour.
 */
export const SECONDS_IN_HOUR = 3600;

/**
 * @constant
 * @name SECONDS_IN_MINUTE
 * @summary Seconds in 1 minute.
 */
export const SECONDS_IN_MINUTE = 60;

/**
 * @constant
 * @name SECONDS_IN_DAY
 * @summary Seconds in 1 day.
 */
export const SECONDS_IN_DAY = SECONDS_IN_HOUR * 24;

/**
 * @constant
 * @name SECONDS_IN_WEEK
 * @summary Seconds in 1 week.
 */
export const SECONDS_IN_WEEK = SECONDS_IN_DAY * 7;

/**
 * @constant
 * @name SECONDS_IN_YEAR
 * @summary Seconds in 1 year.
 */
export const SECONDS_IN_YEAR = SECONDS_IN_DAY * DAYS_IN_YEAR;

/**
 * @constant
 * @name SECONDS_IN_MONTH
 * @summary Seconds in 1 month
 */
export const SECONDS_IN_MONTH = SECONDS_IN_YEAR / 12;

/**
 * @constant
 * @name SECONDS_IN_QUARTER
 * @summary Seconds in 1 quarter.
 */
export const SECONDS_IN_QUARTER = SECONDS_IN_MONTH * 3;
