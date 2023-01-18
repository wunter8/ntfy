import * as React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import {Alert, CardActionArea, CardContent, ListItem, useMediaQuery} from "@mui/material";
import theme from "./theme";
import DialogFooter from "./DialogFooter";
import Button from "@mui/material/Button";
import accountApi, {TopicReservedError, UnauthorizedError} from "../app/AccountApi";
import session from "../app/Session";
import routes from "./routes";
import {useContext, useEffect, useState} from "react";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import {AccountContext} from "./App";
import {formatBytes, formatNumber, formatShortDate} from "../app/utils";
import {Trans, useTranslation} from "react-i18next";
import subscriptionManager from "../app/SubscriptionManager";
import List from "@mui/material/List";
import {Check} from "@mui/icons-material";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";

const UpgradeDialog = (props) => {
    const { t } = useTranslation();
    const { account } = useContext(AccountContext);
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const [tiers, setTiers] = useState(null);
    const [newTier, setNewTier] = useState(account?.tier?.code); // May be undefined
    const [errorText, setErrorText] = useState("");

    useEffect(() => {
        (async () => {
            setTiers(await accountApi.billingTiers());
        })();
    }, []);

    if (!account || !tiers) {
        return <></>;
    }

    const currentTier = account.tier?.code; // May be undefined
    let action, submitButtonLabel, submitButtonEnabled;
    if (currentTier === newTier) {
        submitButtonLabel = t("account_upgrade_dialog_button_update_subscription");
        submitButtonEnabled = false;
        action = null;
    } else if (!currentTier) {
        submitButtonLabel = t("account_upgrade_dialog_button_pay_now");
        submitButtonEnabled = true;
        action = Action.CREATE;
    } else if (!newTier) {
        submitButtonLabel = t("account_upgrade_dialog_button_cancel_subscription");
        submitButtonEnabled = true;
        action = Action.CANCEL;
    } else {
        submitButtonLabel = t("account_upgrade_dialog_button_update_subscription");
        submitButtonEnabled = true;
        action = Action.UPDATE;
    }

    const handleSubmit = async () => {
        try {
            if (action === Action.CREATE) {
                const response = await accountApi.createBillingSubscription(newTier);
                window.location.href = response.redirect_url;
            } else if (action === Action.UPDATE) {
                await accountApi.updateBillingSubscription(newTier);
            } else if (action === Action.CANCEL) {
                await accountApi.deleteBillingSubscription();
            }
            props.onCancel();
        } catch (e) {
            console.log(`[UpgradeDialog] Error changing billing subscription`, e);
            if ((e instanceof UnauthorizedError)) {
                session.resetAndRedirect(routes.login);
            }
            // FIXME show error
        }
    }

    return (
        <Dialog
            open={props.open}
            onClose={props.onCancel}
            maxWidth="md"
            fullWidth
            fullScreen={fullScreen}
        >
            <DialogTitle>{t("account_upgrade_dialog_title")}</DialogTitle>
            <DialogContent>
                <div style={{
                    display: "flex",
                    flexDirection: "row",
                    marginBottom: "8px",
                    width: "100%"
                }}>
                    {tiers.map(tier =>
                        <TierCard
                            key={`tierCard${tier.code || '_free'}`}
                            tier={tier}
                            selected={newTier === tier.code} // tier.code may be undefined!
                            onClick={() => setNewTier(tier.code)} // tier.code may be undefined!
                        />
                    )}
                </div>
                {action === Action.CANCEL &&
                    <Alert severity="warning">
                        <Trans
                            i18nKey="account_upgrade_dialog_cancel_warning"
                            values={{ date: formatShortDate(account.billing.paid_until) }} />
                    </Alert>
                }
                {currentTier && (!action || action === Action.UPDATE) &&
                    <Alert severity="info">
                        <Trans i18nKey="account_upgrade_dialog_proration_info" />
                    </Alert>
                }
            </DialogContent>
            <DialogFooter status={errorText}>
                <Button onClick={props.onCancel}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={!submitButtonEnabled}>{submitButtonLabel}</Button>
            </DialogFooter>
        </Dialog>
    );
};

const TierCard = (props) => {
    const { t } = useTranslation();
    const cardStyle = (props.selected) ? { background: "#eee", border: "2px solid #338574" } : { border: "2px solid transparent" };
    const tier = props.tier;

    return (
        <Card sx={{
            m: 1,
            minWidth: "190px",
            maxWidth: "250px",
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 0,
            "&:first-child": { ml: 0 },
            "&:last-child": { mr: 0 },
            ...cardStyle
        }}>
            <CardActionArea sx={{ height: "100%" }}>
                <CardContent onClick={props.onClick} sx={{ height: "100%" }}>
                    {props.selected &&
                        <div style={{
                            position: "absolute",
                            top: "0",
                            right: "15px",
                            padding: "2px 10px",
                            background: "#338574",
                            color: "white",
                            borderRadius: "3px",
                        }}>{t("account_upgrade_dialog_tier_selected_label")}</div>
                    }
                    <Typography variant="h5" component="div">
                        {tier.name || t("account_usage_tier_free")}
                    </Typography>
                    <List dense>
                        {tier.limits.reservations > 0 && <FeatureItem>{t("account_upgrade_dialog_tier_features_reservations", { reservations: tier.limits.reservations })}</FeatureItem>}
                        <FeatureItem>{t("account_upgrade_dialog_tier_features_messages", { messages: formatNumber(tier.limits.messages) })}</FeatureItem>
                        <FeatureItem>{t("account_upgrade_dialog_tier_features_emails", { emails: formatNumber(tier.limits.emails) })}</FeatureItem>
                        <FeatureItem>{t("account_upgrade_dialog_tier_features_attachment_file_size", { filesize: formatBytes(tier.limits.attachment_file_size, 0) })}</FeatureItem>
                        <FeatureItem>{t("account_upgrade_dialog_tier_features_attachment_total_size", { totalsize: formatBytes(tier.limits.attachment_total_size, 0) })}</FeatureItem>
                    </List>
                    {tier.price &&
                        <Typography variant="subtitle1" sx={{fontWeight: 500}}>
                            {tier.price} / month
                        </Typography>
                    }
                </CardContent>
            </CardActionArea>
        </Card>
    );
}

const FeatureItem = (props) => {
    return (
        <ListItem disableGutters sx={{m: 0, p: 0}}>
            <ListItemIcon sx={{minWidth: "24px"}}>
                <Check fontSize="small" sx={{ color: "#338574" }}/>
            </ListItemIcon>
            <ListItemText
                sx={{mt: "2px", mb: "2px"}}
                primary={
                    <Typography variant="body2">
                        {props.children}
                    </Typography>
                }
            />
        </ListItem>

    );
};

const Action = {
    CREATE: 1,
    UPDATE: 2,
    CANCEL: 3
};

export default UpgradeDialog;
