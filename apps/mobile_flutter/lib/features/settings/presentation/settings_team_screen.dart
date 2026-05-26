import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/backend/backend_api_client.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/models/mobile_session.dart';
import '../../../core/providers/mobile_data_providers.dart';
import '../../../core/session/mobile_session_controller.dart';
import '../../shell/presentation/mobile_surface.dart';

class SettingsTeamScreen extends ConsumerWidget {
  const SettingsTeamScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(mobileSessionProvider).asData?.value;
    final shop =
        ref.watch(shopInfoProvider).asData?.value ?? ShopInfo.fallback();
    final membersAsync = ref.watch(workspaceTeamMembersProvider);
    final members =
        membersAsync.asData?.value ?? const <WorkspaceTeamMemberRecord>[];

    if (session == null) {
      return MobileStandaloneScaffold(
        title: 'Workspace team',
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
          children: const <Widget>[
            MobilePanel(
              title: 'Loading workspace team',
              child: MobileEmptyState(
                icon: Icons.sync_rounded,
                title: 'Checking access',
                body:
                    'Business Hub is loading the signed-in workspace before opening team controls.',
              ),
            ),
          ],
        ),
      );
    }

    if (!session.isOwnerLike) {
      return MobileStandaloneScaffold(
        title: 'Workspace team',
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
          children: const <Widget>[
            MobilePanel(
              title: 'Owner/admin only',
              child: MobileEmptyState(
                icon: Icons.lock_outline_rounded,
                title: 'Team control stays elevated',
                body:
                    'Daily operators should stay focused on selling and stock work. Team role control stays limited to workspace owners and admins.',
              ),
            ),
          ],
        ),
      );
    }

    return MobileStandaloneScaffold(
      title: 'Workspace team',
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
        children: <Widget>[
          MobileScreenLead(
            title: 'Connect staff to ${shop.name}',
            subtitle:
                'Add the exact email a staff member will use to sign in. Business Hub will attach that person to this workspace and keep role control with owner/admin users.',
            icon: Icons.groups_rounded,
            accent: const Color(0xFFE58A47),
            primaryTag: MobileTag(
              label: shop.planLabel,
              icon: Icons.workspace_premium_rounded,
              accent: const Color(0xFFF0C879),
            ),
            secondaryTag: MobileTag(
              label: session.displayRoleLabel,
              icon: Icons.badge_rounded,
              accent: const Color(0xFF4EB79B),
            ),
          ),
          const SizedBox(height: 18),
          MobilePanel(
            title: 'How staff joins',
            action: const MobileTag(
              label: 'SIGN-IN FLOW',
              icon: Icons.login_rounded,
              accent: Color(0xFF4EB79B),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                _TeamBullet(
                  text:
                      'Add the staff member with the same email they will use on the phone.',
                ),
                _TeamBullet(
                  text:
                      'After that, the staff member opens the app and signs in with that email.',
                ),
                _TeamBullet(
                  text:
                      'If it is their first time, they can use password recovery to set or reset their password before signing in.',
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          MobilePanel(
            title: 'Team roster',
            action: MobileTag(
              label: members.isEmpty
                  ? (membersAsync.isLoading ? 'Refreshing' : 'No members')
                  : '${members.length} attached',
              icon: Icons.groups_rounded,
              accent: const Color(0xFFE58A47),
            ),
            child: members.isEmpty
                ? MobileEmptyState(
                    icon: membersAsync.isLoading
                        ? Icons.sync_rounded
                        : Icons.group_off_rounded,
                    title: membersAsync.isLoading
                        ? 'Refreshing workspace team'
                        : 'No attached members yet',
                    body: membersAsync.isLoading
                        ? 'Business Hub is loading the current workspace roster.'
                        : 'Attach staff, viewers, or another store admin so they can sign in with the same email and access this shop.',
                  )
                : Column(
                    children: members
                        .map(
                          (member) => _TeamMemberRow(
                            member: member,
                            onManage: member.canManage
                                ? () => _openManageMemberSheet(
                                    context: context,
                                    ref: ref,
                                    session: session,
                                    member: member,
                                  )
                                : null,
                          ),
                        )
                        .toList(growable: false),
                  ),
          ),
          const SizedBox(height: 18),
          MobilePanel(
            title: 'Add member',
            action: const MobileTag(
              label: 'OWNER / ADMIN',
              icon: Icons.person_add_alt_1_rounded,
              accent: Color(0xFFE58A47),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  'Invite a daily operator, store admin, or read-only reviewer into this workspace.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.white.withValues(alpha: 0.72),
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 14),
                FilledButton.tonalIcon(
                  onPressed: () => _openAddMemberSheet(
                    context: context,
                    ref: ref,
                    session: session,
                  ),
                  icon: const Icon(Icons.person_add_alt_1_rounded),
                  label: const Text('Add workspace member'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openAddMemberSheet({
    required BuildContext context,
    required WidgetRef ref,
    required MobileSession session,
  }) async {
    if (!session.hasShop) {
      return;
    }
    final emailController = TextEditingController();
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    String selectedRole = 'staff';
    bool saving = false;
    String? errorText;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF070B13),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            final roleChoices = session.isOwner
                ? const <DropdownMenuItem<String>>[
                    DropdownMenuItem(
                      value: 'admin',
                      child: Text('Store admin'),
                    ),
                    DropdownMenuItem(
                      value: 'staff',
                      child: Text('Staff operator'),
                    ),
                    DropdownMenuItem(
                      value: 'viewer',
                      child: Text('Read-only viewer'),
                    ),
                  ]
                : const <DropdownMenuItem<String>>[
                    DropdownMenuItem(
                      value: 'staff',
                      child: Text('Staff operator'),
                    ),
                    DropdownMenuItem(
                      value: 'viewer',
                      child: Text('Read-only viewer'),
                    ),
                  ];

            return SafeArea(
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  18,
                  18,
                  18,
                  24 + MediaQuery.of(context).viewInsets.bottom,
                ),
                child: ListView(
                  shrinkWrap: true,
                  children: <Widget>[
                    const MobileSheetHeader(
                      eyebrow: 'Workspace team',
                      title: 'Add member',
                      subtitle:
                          'Attach a person to this shop so they can sign in with the same email on mobile.',
                      icon: Icons.person_add_alt_1_rounded,
                    ),
                    const SizedBox(height: 16),
                    MobileSheetSection(
                      title: 'Member details',
                      child: Column(
                        children: <Widget>[
                          TextField(
                            controller: emailController,
                            keyboardType: TextInputType.emailAddress,
                            decoration: const InputDecoration(
                              labelText: 'Email',
                              hintText: 'operator@example.com',
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: nameController,
                            decoration: const InputDecoration(
                              labelText: 'Full name',
                              hintText: 'Floor Operator',
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: phoneController,
                            keyboardType: TextInputType.phone,
                            decoration: const InputDecoration(
                              labelText: 'Phone',
                              hintText: '+91-9999999999',
                            ),
                          ),
                          const SizedBox(height: 12),
                          DropdownButtonFormField<String>(
                            initialValue: selectedRole,
                            items: roleChoices,
                            onChanged: (value) {
                              if (value == null) {
                                return;
                              }
                              setState(() {
                                selectedRole = value;
                              });
                            },
                            decoration: const InputDecoration(
                              labelText: 'Role',
                            ),
                          ),
                          if (errorText != null) ...<Widget>[
                            const SizedBox(height: 12),
                            Text(
                              errorText!,
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(
                                    color: const Color(0xFFEF6B67),
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                          ],
                          const SizedBox(height: 14),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton.tonalIcon(
                              onPressed: saving
                                  ? null
                                  : () async {
                                      if (emailController.text.trim().isEmpty) {
                                        setState(() {
                                          errorText = 'Email is required.';
                                        });
                                        return;
                                      }
                                      setState(() {
                                        saving = true;
                                        errorText = null;
                                      });
                                      try {
                                        await ref
                                            .read(backendApiClientProvider)
                                            .createWorkspaceTeamMember(
                                              user: session.user,
                                              shopId: session.shopId!,
                                              email: emailController.text
                                                  .trim(),
                                              fullName: nameController.text
                                                  .trim(),
                                              phone: phoneController.text
                                                  .trim(),
                                              role: selectedRole,
                                            );
                                        ref.invalidate(
                                          workspaceTeamMembersProvider,
                                        );
                                        if (!context.mounted) {
                                          return;
                                        }
                                        Navigator.of(context).pop();
                                        ScaffoldMessenger.of(
                                          context,
                                        ).showSnackBar(
                                          const SnackBar(
                                            content: Text(
                                              'Workspace member saved. They can sign in with the same email.',
                                            ),
                                          ),
                                        );
                                      } catch (error) {
                                        setState(() {
                                          errorText = error.toString();
                                          saving = false;
                                        });
                                      }
                                    },
                              icon: saving
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.check_rounded),
                              label: Text(
                                saving ? 'Saving member' : 'Save member',
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _openManageMemberSheet({
    required BuildContext context,
    required WidgetRef ref,
    required MobileSession session,
    required WorkspaceTeamMemberRecord member,
  }) async {
    if (!session.hasShop) {
      return;
    }

    String selectedRole = member.role;
    String selectedStatus = member.status;
    bool saving = false;
    String? errorText;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF070B13),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            final roleChoices = session.isOwner
                ? const <DropdownMenuItem<String>>[
                    DropdownMenuItem(
                      value: 'admin',
                      child: Text('Store admin'),
                    ),
                    DropdownMenuItem(
                      value: 'staff',
                      child: Text('Staff operator'),
                    ),
                    DropdownMenuItem(
                      value: 'viewer',
                      child: Text('Read-only viewer'),
                    ),
                  ]
                : const <DropdownMenuItem<String>>[
                    DropdownMenuItem(
                      value: 'staff',
                      child: Text('Staff operator'),
                    ),
                    DropdownMenuItem(
                      value: 'viewer',
                      child: Text('Read-only viewer'),
                    ),
                  ];

            return SafeArea(
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  18,
                  18,
                  18,
                  24 + MediaQuery.of(context).viewInsets.bottom,
                ),
                child: ListView(
                  shrinkWrap: true,
                  children: <Widget>[
                    MobileSheetHeader(
                      eyebrow: 'Workspace team',
                      title: member.memberName,
                      subtitle: member.memberEmail,
                      icon: Icons.manage_accounts_rounded,
                      tags: <Widget>[
                        MobileTag(
                          label: member.roleLabel,
                          icon: Icons.badge_rounded,
                          accent: const Color(0xFFE58A47),
                        ),
                        MobileTag(
                          label: member.status,
                          icon: Icons.circle_notifications_rounded,
                          accent: const Color(0xFFF0C879),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    MobileSheetSection(
                      title: 'Role and access',
                      child: Column(
                        children: <Widget>[
                          DropdownButtonFormField<String>(
                            initialValue: selectedRole,
                            items: roleChoices,
                            onChanged: (value) {
                              if (value == null) {
                                return;
                              }
                              setState(() {
                                selectedRole = value;
                              });
                            },
                            decoration: const InputDecoration(
                              labelText: 'Role',
                            ),
                          ),
                          const SizedBox(height: 12),
                          DropdownButtonFormField<String>(
                            initialValue: selectedStatus,
                            items: const <DropdownMenuItem<String>>[
                              DropdownMenuItem(
                                value: 'active',
                                child: Text('Active'),
                              ),
                              DropdownMenuItem(
                                value: 'invited',
                                child: Text('Invited'),
                              ),
                              DropdownMenuItem(
                                value: 'disabled',
                                child: Text('Disabled'),
                              ),
                            ],
                            onChanged: (value) {
                              if (value == null) {
                                return;
                              }
                              setState(() {
                                selectedStatus = value;
                              });
                            },
                            decoration: const InputDecoration(
                              labelText: 'Status',
                            ),
                          ),
                          if (errorText != null) ...<Widget>[
                            const SizedBox(height: 12),
                            Text(
                              errorText!,
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(
                                    color: const Color(0xFFEF6B67),
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                          ],
                          const SizedBox(height: 14),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton.tonalIcon(
                              onPressed: saving
                                  ? null
                                  : () async {
                                      setState(() {
                                        saving = true;
                                        errorText = null;
                                      });
                                      try {
                                        await ref
                                            .read(backendApiClientProvider)
                                            .updateWorkspaceTeamMember(
                                              user: session.user,
                                              shopId: session.shopId!,
                                              membershipId: member.id,
                                              role: selectedRole,
                                              status: selectedStatus,
                                            );
                                        ref.invalidate(
                                          workspaceTeamMembersProvider,
                                        );
                                        if (!context.mounted) {
                                          return;
                                        }
                                        Navigator.of(context).pop();
                                        ScaffoldMessenger.of(
                                          context,
                                        ).showSnackBar(
                                          const SnackBar(
                                            content: Text(
                                              'Workspace member updated.',
                                            ),
                                          ),
                                        );
                                      } catch (error) {
                                        setState(() {
                                          saving = false;
                                          errorText = error.toString();
                                        });
                                      }
                                    },
                              icon: saving
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.save_rounded),
                              label: Text(
                                saving ? 'Saving changes' : 'Save changes',
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _TeamMemberRow extends StatelessWidget {
  const _TeamMemberRow({required this.member, this.onManage});

  final WorkspaceTeamMemberRecord member;
  final VoidCallback? onManage;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: const Color(0xFF232A36),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      member.memberName,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  if (onManage != null)
                    FilledButton.tonal(
                      onPressed: onManage,
                      child: const Text('Manage'),
                    ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                member.memberEmail,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.white.withValues(alpha: 0.68),
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: <Widget>[
                  MobileTag(
                    label: member.roleLabel,
                    icon: Icons.badge_rounded,
                    accent: const Color(0xFFE58A47),
                  ),
                  MobileTag(
                    label: member.status,
                    icon: Icons.circle_notifications_rounded,
                    accent: const Color(0xFFF0C879),
                  ),
                  if (member.isCurrentUser)
                    const MobileTag(
                      label: 'YOU',
                      icon: Icons.person_rounded,
                      accent: Color(0xFF4EB79B),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                member.roleSummary,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.white.withValues(alpha: 0.68),
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TeamBullet extends StatelessWidget {
  const _TeamBullet({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            width: 8,
            height: 8,
            margin: const EdgeInsets.only(top: 6),
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: Color(0xFFE58A47),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Colors.white.withValues(alpha: 0.72),
                height: 1.45,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
