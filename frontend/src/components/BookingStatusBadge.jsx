import StatusBadge from './StatusBadge';
import { autoCompletedNote } from '../utils/format';

// A booking's status, with an "Auto" tag when the system completed it.
export default function BookingStatusBadge({ booking }) {
  const auto = booking.status === 'COMPLETED' && booking.autoCompleted;
  return <StatusBadge status={booking.status} tag={auto ? 'Auto' : null} tagTitle={auto ? autoCompletedNote(booking) : undefined} />;
}
