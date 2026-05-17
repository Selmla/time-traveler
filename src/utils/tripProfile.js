import { TRIP_PROFILE } from '../engine/models.js'

export function getProfile(trip) {
  return trip?.tripProfile ?? TRIP_PROFILE.ROADTRIP
}

export function profileCopy(profile) {
  const city = profile === TRIP_PROFILE.CITY_TOURISM
  return {
    // Glance Mode headline labels
    leaveNow:     city ? 'TIME TO LEAVE'  : 'LEAVE NOW',
    leaveSoon:    city ? 'TIME TO GO'     : 'LEAVE SOON',
    timeCritical: city ? 'RUNNING BEHIND' : 'TIME CRITICAL',

    // Glance Mode directives — arrived
    departImmediate:   city ? 'Time to leave'                  : 'DEPART IMMEDIATELY',
    departNow:         city ? 'Time to leave'                  : 'DEPART NOW',
    departWithin: (m) => city ? `Plan to leave within ${m}m`   : `DEPART WITHIN ${m}m`,
    leaveWithin:  (m) => city ? `Plan to leave within ${m}m`   : `LEAVE WITHIN ${m}m`,
    youAreHere:        city ? 'Enjoy your visit'               : 'You are here',

    // Glance Mode directives — traveling
    appointmentAtRisk: city ? 'Reservation may be affected'    : 'APPOINTMENT AT RISK',
    deadlineClose:     city ? 'Time is getting short'          : 'DEADLINE APPROACHING',
    keepGoing:         city ? 'Enjoy the journey'              : 'Keep going',
    behindPlan:        city ? 'Consider adjusting your day'    : 'Behind plan — push the pace',
    replan:            city ? 'Consider re-thinking your day'  : 'Re-plan needed',

    // NowScreen status bar
    deadlineAtRisk:  city ? 'Reservation may be affected' : 'Deadline at risk',
    deadlineMissed:  city ? 'Reservation missed'          : 'Deadline missed',
    gettingTight:    city ? 'This visit is getting tight'  : 'Getting tight',
    bufferLow:       city ? 'Time getting short'           : 'Running low on time',
    cuttingItClose:  city ? 'Running behind schedule'      : 'Cutting it close',
  }
}
