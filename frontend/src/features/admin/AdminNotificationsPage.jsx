import * as adminApi from '../../api/admin';
import NotificationsPage from '../notifications/NotificationsPage';
import { linkForNotification } from './notificationLinks';

export default function AdminNotificationsPage() {
  return <NotificationsPage api={adminApi} linkFor={linkForNotification} />;
}
