import { PublicationDialog, type PublicationDialogProps } from './PublicationDialog';
export function UnpublishDialog(props: PublicationDialogProps) {
  return <PublicationDialog {...props} action="unpublish" />;
}
