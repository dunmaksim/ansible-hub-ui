import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import {
  Button,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import { DropdownItem } from '@patternfly/react-core/deprecated';
import { Table, Tbody, Td, Tr } from '@patternfly/react-table';
import { Component } from 'react';
import { ExecutionEnvironmentRegistryAPI, type RemoteType } from 'src/api';
import {
  AlertList,
  type AlertType,
  AppliedFilters,
  BaseHeader,
  CompoundFilter,
  CopyURL,
  DateComponent,
  DeleteModal,
  EmptyStateFilter,
  EmptyStateNoData,
  EmptyStateUnauthorized,
  HubPagination,
  ListItemActions,
  LoadingSpinner,
  Main,
  RemoteForm,
  SortTable,
  Tooltip,
  closeAlert,
} from 'src/components';
import { AppContext, type IAppContextType } from 'src/loaders/app-context';
import {
  type ErrorMessagesType,
  ParamHelper,
  type RouteProps,
  filterIsSet,
  jsxErrorMessage,
  lastSyncStatus,
  lastSynced,
  mapErrorMessages,
  taskAlert,
  withRouter,
} from 'src/utilities';

interface IState {
  alerts: AlertType[];
  itemCount: number;
  items: RemoteType[];
  loading: boolean;
  params: {
    page?: number;
    page_size?: number;
  };
  remoteFormErrors: ErrorMessagesType;
  remoteFormNew: boolean;
  remoteToEdit?: RemoteType;
  remoteUnmodified?: RemoteType;
  showDeleteModal: boolean;
  showRemoteFormModal: boolean;
  inputText: string;
}

class ExecutionEnvironmentRegistryList extends Component<RouteProps, IState> {
  static contextType = AppContext;

  constructor(props) {
    super(props);

    const params = ParamHelper.parseParamString(props.location.search, [
      'page',
      'page_size',
    ]);

    if (!params['page_size']) {
      params['page_size'] = 10;
    }

    if (!params['sort']) {
      params['sort'] = 'name';
    }

    this.state = {
      alerts: [],
      itemCount: 0,
      items: [],
      loading: true,
      params,
      remoteFormErrors: {},
      remoteFormNew: false,
      remoteToEdit: null,
      remoteUnmodified: null,
      showDeleteModal: false,
      showRemoteFormModal: false,
      inputText: '',
    };
  }

  componentDidMount() {
    this.queryRegistries();
  }

  render() {
    const {
      alerts,
      itemCount,
      items,
      loading,
      params,
      remoteFormErrors,
      remoteFormNew,
      remoteToEdit,
      remoteUnmodified,
      showDeleteModal,
      showRemoteFormModal,
    } = this.state;
    const noData =
      items.length === 0 && !filterIsSet(params, ['name__icontains']);

    if ((this.context as IAppContextType).user.is_anonymous) {
      return <EmptyStateUnauthorized />;
    }

    const { hasPermission } = this.context as IAppContextType;
    const addButton = hasPermission('galaxy.add_containerregistryremote') ? (
      <Button
        onClick={() =>
          this.setState({
            remoteFormErrors: {},
            remoteFormNew: true,
            remoteToEdit: {
              name: '',
              // API defaults to true when not sending anything, make the UI fit
              tls_validation: true,
              write_only_fields: [
                { name: 'username', is_set: false },
                { name: 'password', is_set: false },
                { name: 'proxy_username', is_set: false },
                { name: 'proxy_password', is_set: false },
                { name: 'client_key', is_set: false },
              ],
            } as RemoteType,
            remoteUnmodified: null,
            showRemoteFormModal: true,
          })
        }
      >
        <Trans>Add remote registry</Trans>
      </Button>
    ) : null;

    return (
      <>
        <AlertList
          alerts={alerts}
          closeAlert={(i) =>
            closeAlert(i, {
              alerts,
              setAlerts: (alerts) => this.setState({ alerts }),
            })
          }
        />
        {showRemoteFormModal && (
          <RemoteForm
            remote={remoteToEdit}
            remoteType='registry'
            updateRemote={(r: RemoteType) => this.setState({ remoteToEdit: r })}
            saveRemote={() => {
              const { remoteFormNew, remoteToEdit } = this.state;
              const newRemote = { ...remoteToEdit };

              if (remoteFormNew) {
                // prevent "This field may not be blank." when writing in and then deleting username/password/etc
                // only when creating, edit diffs with remoteUnmodified
                Object.keys(newRemote).forEach((k) => {
                  if (newRemote[k] === '' || newRemote[k] == null) {
                    delete newRemote[k];
                  }
                });
              }

              const promise = remoteFormNew
                ? ExecutionEnvironmentRegistryAPI.create(newRemote)
                : ExecutionEnvironmentRegistryAPI.smartUpdate(
                    remoteToEdit.id,
                    remoteToEdit,
                    remoteUnmodified,
                  );

              promise
                .then(() => {
                  this.setState(
                    {
                      remoteToEdit: null,
                      remoteUnmodified: null,
                      showRemoteFormModal: false,
                    },
                    () => this.queryRegistries(),
                  );
                })
                .catch((err) =>
                  this.setState({ remoteFormErrors: mapErrorMessages(err) }),
                );
            }}
            errorMessages={remoteFormErrors}
            showModal={showRemoteFormModal}
            closeModal={() =>
              this.setState({
                remoteToEdit: null,
                remoteUnmodified: null,
                showRemoteFormModal: false,
              })
            }
            allowEditName={remoteFormNew}
            title={
              remoteFormNew ? t`Add remote registry` : t`Edit remote registry`
            }
          />
        )}
        {showDeleteModal && remoteToEdit && (
          <DeleteModal
            cancelAction={() =>
              this.setState({ showDeleteModal: false, remoteToEdit: null })
            }
            deleteAction={() => this.deleteRegistry(remoteToEdit)}
            title={t`Delete remote registry?`}
          >
            <Trans>
              <b>{remoteToEdit.name}</b> will be deleted.
            </Trans>
          </DeleteModal>
        )}
        <BaseHeader title={t`Remote registries`} />
        {noData && !loading ? (
          <EmptyStateNoData
            title={t`No remote registries yet`}
            description={t`You currently have no remote registries.`}
            button={addButton}
          />
        ) : (
          <Main>
            {loading ? (
              <LoadingSpinner />
            ) : (
              <section className='body'>
                <div className='hub-toolbar'>
                  <Toolbar>
                    <ToolbarContent>
                      <ToolbarGroup>
                        <ToolbarItem>
                          <CompoundFilter
                            inputText={this.state.inputText}
                            onChange={(text) =>
                              this.setState({ inputText: text })
                            }
                            updateParams={(p) =>
                              this.updateParams(p, () => this.queryRegistries())
                            }
                            params={params}
                            filterConfig={[
                              {
                                id: 'name__icontains',
                                title: t`Name`,
                              },
                            ]}
                          />
                        </ToolbarItem>
                        <ToolbarItem>{addButton}</ToolbarItem>
                      </ToolbarGroup>
                    </ToolbarContent>
                  </Toolbar>

                  <HubPagination
                    params={params}
                    updateParams={(p) =>
                      this.updateParams(p, () => this.queryRegistries())
                    }
                    count={itemCount}
                    isTop
                  />
                </div>
                <div>
                  <AppliedFilters
                    updateParams={(p) => {
                      this.updateParams(p, () => this.queryRegistries());
                      this.setState({ inputText: '' });
                    }}
                    params={params}
                    ignoredParams={['page_size', 'page', 'sort']}
                    niceNames={{
                      name__icontains: t`Name`,
                    }}
                  />
                </div>
                {this.renderTable(params)}
                <HubPagination
                  params={params}
                  updateParams={(p) =>
                    this.updateParams(p, () => this.queryRegistries())
                  }
                  count={itemCount}
                />
              </section>
            )}
          </Main>
        )}
      </>
    );
  }

  private renderTable(params) {
    const { items } = this.state;
    if (items.length === 0) {
      return <EmptyStateFilter />;
    }

    const sortTableOptions = {
      headers: [
        {
          title: t`Name`,
          type: 'alpha',
          id: 'name',
        },
        {
          title: t`Created`,
          type: 'alpha',
          id: 'created_at',
        },
        {
          title: t`Last updated`,
          type: 'alpha',
          id: 'updated_at',
        },
        {
          title: t`Registry URL`,
          type: 'alpha',
          id: 'url',
        },
        {
          title: t`Registry sync status`,
          type: 'none',
          id: 'last_sync_task',
        },
        {
          title: '',
          type: 'none',
          id: 'controls',
        },
      ],
    };

    return (
      <Table>
        <SortTable
          options={sortTableOptions}
          params={params}
          updateParams={(p) =>
            this.updateParams(p, () => this.queryRegistries())
          }
        />
        <Tbody>{items.map((user, i) => this.renderTableRow(user, i))}</Tbody>
      </Table>
    );
  }

  private renderTableRow(item, index: number) {
    const { hasPermission } = this.context as IAppContextType;
    const buttons = [
      hasPermission('galaxy.change_containerregistryremote') && (
        <Button
          key='sync'
          variant='secondary'
          onClick={() => this.syncRegistry(item)}
        >
          <Trans>Sync from registry</Trans>
        </Button>
      ),
    ];

    const dropdownItems = [
      hasPermission('galaxy.change_containerregistryremote') && (
        <DropdownItem
          key='edit'
          onClick={() =>
            this.setState({
              remoteFormErrors: {},
              remoteFormNew: false,
              remoteToEdit: { ...item },
              remoteUnmodified: { ...item },
              showRemoteFormModal: true,
            })
          }
        >
          <Trans>Edit</Trans>
        </DropdownItem>
      ),
      hasPermission('galaxy.delete_containerregistryremote') && (
        <DropdownItem
          key='delete'
          onClick={() =>
            this.setState({
              showDeleteModal: true,
              remoteToEdit: item,
            })
          }
        >
          <Trans>Delete</Trans>
        </DropdownItem>
      ),
      <Tooltip
        key='index'
        content={
          item.is_indexable
            ? t`Find execution environments in this registry`
            : t`Indexing execution environments is only supported on registry.redhat.io`
        }
      >
        <DropdownItem
          onClick={() => this.indexRegistry(item)}
          isDisabled={!item.is_indexable}
        >
          <Trans>Index execution environments</Trans>
        </DropdownItem>
      </Tooltip>,
    ].filter(Boolean);
    return (
      <Tr
        data-cy={`ExecutionEnvironmentRegistryList-row-${item.name}`}
        key={index}
      >
        <Td>{item.name}</Td>
        <Td>
          <DateComponent date={item.created_at} />
        </Td>
        <Td>
          <DateComponent date={item.updated_at} />
        </Td>
        <Td>
          <CopyURL url={item.url} />
        </Td>
        <Td>
          {lastSyncStatus(item) || '---'}
          {lastSynced(item)}
        </Td>
        <ListItemActions kebabItems={dropdownItems} buttons={buttons} />
      </Tr>
    );
  }

  private queryRegistries(noLoading = false) {
    this.setState(noLoading ? null : { loading: true }, () =>
      ExecutionEnvironmentRegistryAPI.list(this.state.params).then((result) => {
        const isAnyRunning = result.data.data.some((task) =>
          ['running', 'waiting'].includes(task.last_sync_task.state),
        );

        if (isAnyRunning) {
          setTimeout(() => this.queryRegistries(true), 5000);
        }

        this.setState({
          items: result.data.data,
          itemCount: result.data.meta.count,
          loading: false,
        });
      }),
    );
  }

  private deleteRegistry({ id, name }) {
    ExecutionEnvironmentRegistryAPI.delete(id)
      .then(() =>
        this.addAlert(
          <Trans>
            Remote registry &quot;{name}&quot; has been successfully deleted.
          </Trans>,
          'success',
        ),
      )
      .catch((err) => {
        const { status, statusText } = err.response;
        this.addAlert(
          t`Remote registry "${name}" could not be deleted.`,
          'danger',
          jsxErrorMessage(status, statusText),
        );
      })
      .then(() => {
        this.queryRegistries();
        this.setState({ showDeleteModal: false, remoteToEdit: null });
      });
  }

  private syncRegistry({ id, name }) {
    ExecutionEnvironmentRegistryAPI.sync(id)
      .then(({ data }) => {
        this.addAlertObj(
          taskAlert(data.task, t`Sync started for remote registry "${name}".`),
        );
        this.queryRegistries(true);
      })
      .catch((err) => {
        const { status, statusText } = err.response;
        this.addAlert(
          t`Remote registry "${name}" could not be synced.`,
          'danger',
          jsxErrorMessage(status, statusText),
        );
      });
  }

  private indexRegistry({ id, name }) {
    ExecutionEnvironmentRegistryAPI.index(id)
      .then(({ data }) => {
        this.addAlertObj(
          taskAlert(
            data.task,
            t`Indexing started for execution environment "${name}".`,
            'success',
          ),
        );
      })
      .catch((err) => {
        const { status, statusText } = err.response;
        this.addAlert(
          t`Execution environment "${name}" could not be indexed.`,
          'danger',
          jsxErrorMessage(status, statusText),
        );
      });
  }

  private addAlertObj(alert: AlertType) {
    this.setState({
      alerts: [...this.state.alerts, alert],
    });
  }

  private addAlert(title, variant, description?) {
    this.addAlertObj({
      description,
      title,
      variant,
    });
  }

  private updateParams(params, callback = null) {
    ParamHelper.updateParams({
      params,
      navigate: (to) => this.props.navigate(to),
      setState: (state) => this.setState(state, callback),
    });
  }
}

export default withRouter(ExecutionEnvironmentRegistryList);
