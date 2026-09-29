import { useNavigate, useSearchParams } from 'react-router-dom';
import type { PaymentType } from '@/lib/admin/payments';
import { AdminShell } from '@/features/events/admin/shared';
import PaymentForm from './PaymentForm';

/** Money → Collect payment. ?member=, ?type=pt|other and ?package= arrive from profiles, dues and PT links. */
const RecordPayment = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const type = (['membership', 'pt', 'other'].includes(params.get('type') ?? '') ? params.get('type') : 'membership') as PaymentType;
  const memberId = params.get('member');
  return (
    <AdminShell title="Collect payment" nav="payments" area="Money" back={{ to: memberId ? `/admin/members/${memberId}` : '/admin/payments', label: memberId ? 'Member' : 'Payments' }}>
      <PaymentForm initial={{ memberId, type, packageId: params.get('package') }} onSaved={(id) => navigate(`/admin/payments/${id}?new=1`)} />
    </AdminShell>
  );
};

export default RecordPayment;
