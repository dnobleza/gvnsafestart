import {
  BellIcon,
  CalendarBlankIcon,
  CalendarCheckIcon,
  ClockIcon,
  CoinsIcon,
  HouseIcon,
  StarIcon,
  UserCircleIcon,
  UsersIcon,
} from '@phosphor-icons/react';

import * as instructorApi from '../../api/instructor';
import DashboardLayout from '../../components/DashboardLayout';
import NotificationBell from '../notifications/NotificationBell';
import { linkForNotification } from './notificationLinks';

const NAV = [
  { to: '/instructor', label: 'Home', icon: HouseIcon, end: true },
  { to: '/instructor/schedule', label: 'Schedule', icon: CalendarBlankIcon },
  { to: '/instructor/bookings', label: 'Bookings', icon: CalendarCheckIcon },
  { to: '/instructor/clients', label: 'Clients', icon: UsersIcon },
  { to: '/instructor/availability', label: 'Availability', icon: ClockIcon },
  { to: '/instructor/cash', label: 'My cash', icon: CoinsIcon },
  { to: '/instructor/ratings', label: 'Ratings', icon: StarIcon },
  { to: '/instructor/notifications', label: 'Notifications', icon: BellIcon },
  { to: '/instructor/profile', label: 'Profile', icon: UserCircleIcon },
];

export default function InstructorLayout() {
  return (
    <DashboardLayout
      nav={NAV}
      navLabel="Instructor"
      headerExtras={
        <NotificationBell api={instructorApi} linkFor={linkForNotification} allPath="/instructor/notifications" />
      }
    />
  );
}
