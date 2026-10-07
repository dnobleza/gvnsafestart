import { register } from '../../../api/auth';
import useAuthSubmit from './useAuthSubmit';

export default function useRegister() {
  return useAuthSubmit(register);
}
