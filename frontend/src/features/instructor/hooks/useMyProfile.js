import { getMyProfile } from '../../../api/instructor';
import useResource from '../../../hooks/useResource';

export default function useMyProfile() {
  return useResource(getMyProfile);
}
