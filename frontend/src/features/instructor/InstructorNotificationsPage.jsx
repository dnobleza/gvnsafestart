import * as instructorApi from '../../api/instructor';
import NotificationsPage from '../notifications/NotificationsPage';
import { linkForNotification } from './notificationLinks';

export default function InstructorNotificationsPage() {
  return <NotificationsPage api={instructorApi} linkFor={linkForNotification} />;
}
