import { BellIcon, CalendarCheckIcon, CalendarPlusIcon, HouseIcon, PackageIcon, UserCircleIcon } from '@phosphor-icons/react';

import * as clientApi from '../../api/clientPortal';
import DashboardLayout from '../../components/DashboardLayout';
import NotificationBell from '../notifications/NotificationBell';
import { linkForNotification } from './notificationLinks';

const NAV = [
  { to: '/client', label: 'Home', icon: HouseIcon, end: true },
  { to: '/client/book', label: 'Book a lesson', icon: CalendarPlusIcon },
  { to: '/client/packages', label: 'My packages', icon: PackageIcon },
  { to: '/client/bookings', label: 'My bookings', icon: CalendarCheckIcon },
  { to: '/client/notifications', label: 'Notifications', icon: BellIcon },
  { to: '/client/profile', label: 'Profile', icon: UserCircleIcon },
];

export default function ClientLayout() {
  return (
    <DashboardLayout
      nav={NAV}
      navLabel="Client"
      headerExtras={<NotificationBell api={clientApi} linkFor={linkForNotification} allPath="/client/notifications" />}
    />
  );
}
