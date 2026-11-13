import { ORDER_STATUS } from '../utils';

export default function StatusBadge({ status }) {
  const { label, tone } = ORDER_STATUS[status] || { label: status, tone: 'muted' };
  return <span className={`status status-${tone}`}>{label}</span>;
}
