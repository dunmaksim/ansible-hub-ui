import { Label } from '@patternfly/react-core';
import { Tooltip } from 'src/components';
import { truncateSha } from 'src/utilities';

interface IProps {
  digest: string;
  grey?: boolean;
  long?: boolean;
}

export const ShaLabel = ({ digest, grey, long }: IProps) => (
  <Tooltip content={digest}>
    <Label color={grey ? 'grey' : 'blue'}>
      {long ? digest : truncateSha(digest)}
    </Label>
  </Tooltip>
);
