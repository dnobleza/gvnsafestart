import * as clientApi from '../../api/clientPortal';
import NotificationsPage from '../notifications/NotificationsPage';
import { linkForNotification } from './notificationLinks';

export default function ClientNotificationsPage() {
  return <NotificationsPage api={clientApi} linkFor={linkForNotification} />;
}
