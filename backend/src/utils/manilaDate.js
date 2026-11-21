const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });

/** The Asia/Manila calendar date as YYYYMMDD (the server runs in UTC). */
export const manilaDateKey = (date = new Date()) => parts.format(date).replaceAll('-', '');
