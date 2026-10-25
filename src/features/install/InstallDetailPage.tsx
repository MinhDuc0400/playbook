/** Placeholder screen (lead stub). Replaced by its phase task. */
import { t } from '@/i18n/vi';

export default function InstallDetailPage(): JSX.Element {
  return (
    <div className="p-6" data-testid="page-placeholder">
      <h1 className="text-xl font-semibold">InstallDetailPage</h1>
      <p>{t.common.comingSoon}</p>
    </div>
  );
}
