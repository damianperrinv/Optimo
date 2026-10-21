/* Shared presentation vocabulary. Source adapters provide explicit family metadata. */
(function (root) {
  const number = value => Math.max(0, Number(value) || 0);
  const count = record => { const value=record.bookingsCount ?? record.bookings ?? record.attendees ?? record.att; return Array.isArray(value)?value.length:number(value); };
  function publicEvent(record = {}) {
    const bookings = count(record);
    const conditional = record.provisional === true || record.confirmOnFirstBooking === true || record.confirmation === 'provisional';
    return {family:'public',label:'Public event',tone:'public',confirmation:record.confirmation !== 'confirmed' && conditional && bookings === 0 ? 'provisional' : 'confirmed',
      recurrence:null,publication:record.preliminary || record.publication === 'draft' ? 'draft' : 'published',reason:null,bookings,
      confirmOnFirstBooking:conditional};
  }
  function privateBooking(record = {}) {
    const type = String(record.recurrence || record.bookingType || record.type || '').toLowerCase();
    const recurrence = /season/.test(type) ? 'seasonal' : /regular|recurr/.test(type) ? 'regular' : 'casual';
    return {family:'private',label:'Private booking',tone:'private',confirmation:/unconfirmed|provisional/.test(record.confirmation || record.status || '') ? 'provisional' : 'confirmed',
      recurrence,publication:'published',reason:null,bookings:1};
  }
  function block(record = {}) {
    return {family:'block',label:'Block',tone:'block',confirmation:record.draft || record.status === 'planning' ? 'provisional' : 'confirmed',
      recurrence:null,publication:'published',reason:record.reason || 'Closure',bookings:0};
  }
  function describe(record = {}) {
    if (record.family === 'block') return block(record);
    if (record.family === 'private' || record.kind === 'private') return privateBooking(record);
    if (record.family === 'public' || record.kind === 'public') return publicEvent(record);
    return {family:'internal',label:record.label || 'Internal work',tone:'neutral',confirmation:null,recurrence:null,publication:'published',reason:null,bookings:0};
  }
  root.OptimoBookingModel = Object.freeze({publicEvent,privateBooking,block,describe,
    colours:Object.freeze({public:'#2563eb',private:'#7c3aed',block:'#64748b'}),
    legend:Object.freeze([{family:'public',label:'Public event'},{family:'private',label:'Private booking'},{family:'block',label:'Block'}])});
})(globalThis);
