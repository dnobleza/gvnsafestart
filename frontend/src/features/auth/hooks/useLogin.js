import { login } from '../../../api/auth';
import useAuthSubmit from './useAuthSubmit';

export default function useLogin() {
  return useAuthSubmit(login);
}
