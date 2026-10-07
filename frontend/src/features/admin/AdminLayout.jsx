import {
  BellIcon,
  CalendarCheckIcon,
  ClipboardTextIcon,
  CreditCardIcon,
  GearIcon,
  MapPinIcon,
  PackageIcon,
  ShieldCheckIcon,
  SquaresFourIcon,
  StarIcon,
  SteeringWheelIcon,
} from '@phosphor-icons/react';

import * as adminApi from '../../api/admin';
import DashboardLayout from '../../components/DashboardLayout';
import NotificationBell from '../notifications/NotificationBell';
import { linkForNotification } from './notificationLinks';

const NAV = [
  { to: '/admin', label: 'Overview', icon: SquaresFourIcon, end: true },
  { to: '/admin/bookings', label: 'Bookings', icon: CalendarCheckIcon },
  { to: '/admin/payments', label: 'Payments', icon: CreditCardIcon },
  { to: '/admin/packages', label: 'Packages', icon: PackageIcon },
  { to: '/admin/ratings', label: 'Ratings', icon: StarIcon },
  { to: '/admin/instructors', label: 'Instructors', icon: SteeringWheelIcon },
  { to: '/admin/branches', label: 'Branches', icon: MapPinIcon },
  { to: '/admin/admins', label: 'Admins', icon: ShieldCheckIcon },
  { to: '/admin/audit-log', label: 'Audit log', icon: ClipboardTextIcon },
  { to: '/admin/notifications', label: 'Notifications', icon: BellIcon },
  { to: '/admin/settings', label: 'Settings', icon: GearIcon },
];

export default function AdminLayout() {
  return (
    <DashboardLayout
      nav={NAV}
      navLabel="Admin"
      headerExtras={<NotificationBell api={adminApi} linkFor={linkForNotification} allPath="/admin/notifications" />}
    />
  );
}
