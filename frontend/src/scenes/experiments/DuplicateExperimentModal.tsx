import { useActions, useValues } from 'kea'
import { useState } from 'react'

import { LemonModal, LemonSelect, LemonTable, Link } from '@posthog/lemon-ui'

import { IconOpenInNew } from 'lib/lemon-ui/icons'
import { LemonButton } from 'lib/lemon-ui/LemonButton'
import { LemonDivider } from 'lib/lemon-ui/LemonDivider'
import { experimentsLogic } from 'scenes/experiments/experimentsLogic'
import { FeatureFlagFiltersSection } from 'scenes/feature-flags/FeatureFlagFilters'
import { organizationLogic } from 'scenes/organizationLogic'
import { teamLogic } from 'scenes/teamLogic'
import { urls } from 'scenes/urls'

import { Experiment, FeatureFlagType } from '~/types'

import { featureFlagEligibleForExperiment } from './utils'

interface DuplicateExperimentModalProps {
    isOpen: boolean
    onClose: () => void
    experiment: Experiment
}

export function DuplicateExperimentModal({ isOpen, onClose, experiment }: DuplicateExperimentModalProps): JSX.Element {
    const {
        featureFlagModalFeatureFlags,
        featureFlagModalFeatureFlagsLoading,
        featureFlagModalFilters,
        featureFlagModalPagination,
        copyExperimentToProjectLoading,
    } = useValues(experimentsLogic)
    const { duplicateExperiment, copyExperimentToProject, setFeatureFlagModalFilters, resetFeatureFlagModalFilters } =
        useActions(experimentsLogic)
    const { currentOrganization } = useValues(organizationLogic)
    const { currentTeam } = useValues(teamLogic)

    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)

    const hasMultipleProjects = (currentOrganization?.teams?.length ?? 0) > 1

    const handleDuplicate = (featureFlagKey?: string): void => {
        duplicateExperiment({ id: experiment.id as number, featureFlagKey })
        onClose()
    }

    const handleCopyToProject = (): void => {
        if (selectedProjectId) {
            copyExperimentToProject({ id: experiment.id as number, targetProjectId: selectedProjectId })
            onClose()
        }
    }

    const handleClose = (): void => {
        resetFeatureFlagModalFilters()
        setSelectedProjectId(null)
        onClose()
    }

    return (
        <LemonModal isOpen={isOpen} onClose={handleClose} title="Duplicate experiment" width="max-content">
            <div className="space-y-4">
                <div className="text-muted max-w-xl">
                    Select a feature flag for the duplicated experiment. You can reuse the original flag or choose a
                    different one. If the flag doesn't exist, create it first, then return to this page.
                </div>

                {hasMultipleProjects && (
                    <>
                        <div>
                            <div className="font-semibold mb-2">Copy to another project</div>
                            <div className="text-muted text-xs mb-2">
                                The experiment and its feature flag will be copied as a draft. The feature flag will be
                                disabled by default.
                            </div>
                            <div className="flex items-center gap-2">
                                <LemonSelect
                                    placeholder="Select a project"
                                    dropdownMatchSelectWidth={false}
                                    value={selectedProjectId}
                                    onChange={(id) => setSelectedProjectId(id)}
                                    options={
                                        currentOrganization?.teams
                                            ?.map((team) => ({ value: team.id, label: team.name }))
                                            .sort((a, b) => a.label.localeCompare(b.label))
                                            .filter((option) => option.value !== currentTeam?.id) || []
                                    }
                                    className="min-w-[10rem]"
                                />
                                <LemonButton
                                    type="primary"
                                    size="small"
                                    disabledReason={!selectedProjectId ? 'Select a project' : undefined}
                                    loading={copyExperimentToProjectLoading}
                                    onClick={handleCopyToProject}
                                >
                                    Copy
                                </LemonButton>
                            </div>
                        </div>
                        <LemonDivider />
                    </>
                )}

                <div>
                    <div className="font-semibold mb-2">Use the same flag</div>
                    <div className="flex items-center justify-between p-3 border rounded bg-bg-light">
                        <div className="flex items-center" style={{ fontSize: '13px' }}>
                            <div className="font-semibold text-secondary">{experiment.feature_flag?.key}</div>
                            <Link
                                to={urls.featureFlag(experiment.feature_flag?.id as number)}
                                target="_blank"
                                className="flex items-center text-secondary"
                            >
                                <IconOpenInNew className="ml-1" />
                            </Link>
                        </div>
                        <LemonButton type="primary" size="xsmall" onClick={() => handleDuplicate()}>
                            Select
                        </LemonButton>
                    </div>
                </div>

                <div>
                    <div className="font-semibold mb-2">Choose an existing flag</div>
                    <div className="mb-4">
                        <FeatureFlagFiltersSection
                            filters={featureFlagModalFilters}
                            setFeatureFlagsFilters={setFeatureFlagModalFilters}
                            searchPlaceholder="Search for feature flags"
                            filtersConfig={{ search: true, type: true }}
                        />
                    </div>
                    <LemonTable
                        id="ff"
                        dataSource={featureFlagModalFeatureFlags.results}
                        loading={featureFlagModalFeatureFlagsLoading}
                        useURLForSorting={false}
                        columns={[
                            {
                                title: 'Key',
                                dataIndex: 'key',
                                sorter: (a, b) => (a.key || '').localeCompare(b.key || ''),
                                render: (key, flag) => (
                                    <div className="flex items-center">
                                        <div className="font-semibold">{String(key ?? '')}</div>
                                        <Link
                                            to={urls.featureFlag(flag.id as number)}
                                            target="_blank"
                                            className="flex items-center"
                                        >
                                            <IconOpenInNew className="ml-1" />
                                        </Link>
                                    </div>
                                ),
                            },
                            {
                                title: 'Name',
                                dataIndex: 'name',
                                sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
                            },
                            {
                                title: null,
                                render: function RenderActions(_, flag: FeatureFlagType) {
                                    // Skip the current experiment's flag since we show it separately
                                    if (flag.key === experiment.feature_flag?.key) {
                                        return null
                                    }

                                    let disabledReason: string | undefined = undefined
                                    try {
                                        featureFlagEligibleForExperiment(flag)
                                    } catch (error) {
                                        disabledReason = (error as Error).message
                                    }
                                    return (
                                        <LemonButton
                                            size="xsmall"
                                            type="primary"
                                            disabledReason={disabledReason}
                                            onClick={() => handleDuplicate(flag.key)}
                                        >
                                            Select
                                        </LemonButton>
                                    )
                                },
                            },
                        ]}
                        emptyState="No feature flags match these filters."
                        pagination={featureFlagModalPagination}
                        onSort={(newSorting) =>
                            setFeatureFlagModalFilters({
                                order: newSorting
                                    ? `${newSorting.order === -1 ? '-' : ''}${newSorting.columnKey}`
                                    : undefined,
                                page: 1,
                            })
                        }
                    />
                </div>
            </div>
        </LemonModal>
    )
}
