import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Flex, FlexItem, Label } from '@patternfly/react-core';
import { Td } from '@patternfly/react-table';
import { type FunctionComponent, useEffect, useState } from 'react';
import { RoleAPI, type RoleType } from 'src/api';
import {
  AppliedFilters,
  CheckboxRow,
  CompoundFilter,
  EmptyStateFilter,
  EmptyStateNoData,
  HubPagination,
  LoadingSpinner,
  RoleListTable,
} from 'src/components';
import { filterIsSet, translateLockedRole } from 'src/utilities';

interface SelectRolesProps {
  assignedRoles: { role: string }[];
  selectedRoles: RoleType[];
  onRolesUpdate?: (roles) => void;
  message?: string;
  pulpObjectType?: string;
}

export const SelectRoles: FunctionComponent<SelectRolesProps> = ({
  assignedRoles,
  selectedRoles,
  onRolesUpdate,
  message,
  pulpObjectType,
}) => {
  const [inputText, setInputText] = useState<string>('');
  const [roles, setRoles] = useState<RoleType[]>([]);
  const [rolesItemCount, setRolesItemCount] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(true);
  const [localParams, setLocalParams] = useState({
    page: 1,
    page_size: 10,
    sort: 'name',
  });

  useEffect(() => {
    queryRoles();
  }, [localParams]);

  const queryRoles = () => {
    setLoading(true);
    RoleAPI.list(
      { name__startswith: 'galaxy.', ...localParams },
      pulpObjectType,
    ).then(({ data }) => {
      setRoles(data.results);
      setRolesItemCount(data.count);
      setLoading(false);
    });
  };

  if (loading) {
    return (
      <div className='hub-custom-wizard-layout hub-loading-wizard'>
        <LoadingSpinner />
      </div>
    );
  }

  const isRoleSelected = (name) =>
    selectedRoles.map((r) => r.name).includes(name);

  const noData = roles.length === 0;

  if (noData && !filterIsSet(localParams, ['name__icontains'])) {
    return (
      <div className='hub-custom-wizard-layout hub-no-data'>
        <EmptyStateNoData
          title={t`No assignable roles.`}
          description={t`There are currently no roles that can be assigned to this group.`}
        />
      </div>
    );
  }

  const isAssigned = (name) => assignedRoles.some((role) => role.role === name);

  const tabHeader = {
    headers: [
      {
        title: '',
        type: 'none',
        id: 'expander',
      },
      {
        title: t`Role`,
        type: 'alpha',
        id: 'name',
      },
      {
        title: t`Description`,
        type: 'none',
        id: 'description',
      },
    ],
  };

  return (
    <div className='hub-custom-wizard-layout'>
      <Flex
        justifyContent={{
          default: noData
            ? 'justifyContentFlexStart'
            : 'justifyContentSpaceBetween',
        }}
        direction={{ default: 'column' }}
      >
        <FlexItem className='hub-select-roles-content'>
          <Flex
            justifyContent={{
              default: noData
                ? 'justifyContentFlexStart'
                : 'justifyContentSpaceBetween',
            }}
            direction={{ default: 'column' }}
          >
            {message && (
              <FlexItem>
                <Flex>
                  <FlexItem>{message}</FlexItem>
                </Flex>
              </FlexItem>
            )}

            {Object.keys(selectedRoles).length !== 0 && (
              <FlexItem>
                <Flex>
                  <FlexItem>
                    <strong>
                      <Trans>Selected roles</Trans>
                    </strong>
                  </FlexItem>

                  <FlexItem flex={{ default: 'flex_1' }}>
                    <Flex>
                      {selectedRoles.map((role) => (
                        <FlexItem
                          key={role.name}
                          className='hub-permission'
                          data-cy={`HubPermission-${role.name}`}
                        >
                          <Label
                            onClose={() =>
                              onRolesUpdate(
                                selectedRoles.filter(
                                  (r) => r.name !== role.name,
                                ),
                              )
                            }
                          >
                            {role.name}
                          </Label>
                        </FlexItem>
                      ))}
                    </Flex>
                  </FlexItem>
                </Flex>
              </FlexItem>
            )}

            <FlexItem>
              <div className='hub-filter'>
                <CompoundFilter
                  inputText={inputText}
                  onChange={(inputText) => setInputText(inputText)}
                  params={localParams}
                  updateParams={(p) => setLocalParams(p)}
                  filterConfig={[
                    {
                      id: 'name__icontains',
                      title: t`Name`,
                    },
                  ]}
                />
              </div>

              <AppliedFilters
                updateParams={(p) => {
                  setLocalParams(p);
                  setInputText('');
                }}
                params={localParams}
                niceNames={{ name__icontains: t`Name` }}
                ignoredParams={['sort', 'page_size', 'page']}
                style={{ marginTop: '8px' }}
              />
            </FlexItem>

            <FlexItem style={{ flexGrow: 1 }}>
              {noData && filterIsSet(localParams, ['name__icontains']) ? (
                <div className='hub-no-filter-data'>
                  <EmptyStateFilter />
                </div>
              ) : (
                <div className='hub-selected-roles-list'>
                  <RoleListTable
                    isStickyHeader
                    params={localParams}
                    updateParams={(p) => {
                      setLocalParams(p);
                    }}
                    tableHeader={tabHeader}
                  >
                    {roles.map((role, i) => (
                      <CheckboxRow
                        rowIndex={i}
                        key={role.name}
                        isSelected={
                          isRoleSelected(role.name) || isAssigned(role.name)
                        }
                        onSelect={() =>
                          onRolesUpdate(
                            isRoleSelected(role.name)
                              ? selectedRoles.filter(
                                  (r) => r.name !== role.name,
                                )
                              : [...selectedRoles, role],
                          )
                        }
                        isDisabled={isAssigned(role.name)}
                        data-cy={`RoleListTable-CheckboxRow-row-${role.name}`}
                      >
                        <Td>{role.name}</Td>
                        <Td>
                          {translateLockedRole(role.name, role.description)}
                        </Td>
                      </CheckboxRow>
                    ))}
                  </RoleListTable>
                </div>
              )}
            </FlexItem>
          </Flex>
        </FlexItem>

        {!noData && (
          <FlexItem>
            <HubPagination
              params={localParams}
              updateParams={(p) => setLocalParams(p)}
              count={rolesItemCount}
            />
          </FlexItem>
        )}
      </Flex>
    </div>
  );
};
