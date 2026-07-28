from django.test import TestCase
from rest_framework.test import APIClient
from django.urls import reverse
from platform_apps.users.models import PlatformUser
from platform_apps.shops.models import Shop
from platform_apps.notifications.models import Notification

class NotificationAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = PlatformUser.objects.create_user(email="user1@example.com", password="password")
        self.user2 = PlatformUser.objects.create_user(email="user2@example.com", password="password")
        self.shop1 = Shop.objects.create(name="Shop 1")
        
        # User 1 notifications
        self.n1 = Notification.objects.create(
            recipient=self.user1,
            title="N1",
            message="Msg 1"
        )
        self.n2 = Notification.objects.create(
            recipient=self.user1,
            shop=self.shop1,
            title="N2",
            message="Msg 2",
            is_read=True
        )
        self.n3 = Notification.objects.create(
            recipient=self.user1,
            shop=self.shop1,
            title="N3",
            message="Msg 3"
        )
        
        # User 2 notifications
        self.n4 = Notification.objects.create(
            recipient=self.user2,
            title="N4",
            message="Msg 4"
        )

    def test_list_notifications_unauthenticated(self):
        res = self.client.get(reverse("notification-list"))
        self.assertEqual(res.status_code, 401)

    def test_list_notifications(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.get(reverse("notification-list"))
        self.assertEqual(res.status_code, 200)
        
        # By default DRF list might be paginated or not depending on DEFAULT_PAGINATION_CLASS
        # Assuming no pagination or list of dicts directly, or we check 'results'
        data = res.json()
        results = data.get("results", data) if isinstance(data, dict) else data
        
        self.assertEqual(len(results), 3)
        titles = [n['title'] for n in results]
        self.assertIn("N1", titles)
        self.assertIn("N2", titles)
        self.assertIn("N3", titles)

    def test_list_notifications_filtered_by_shop(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.get(reverse("notification-list"), {"shop_id": str(self.shop1.id)})
        self.assertEqual(res.status_code, 200)
        
        data = res.json()
        results = data.get("results", data) if isinstance(data, dict) else data
        
        self.assertEqual(len(results), 2)
        titles = [n['title'] for n in results]
        self.assertIn("N2", titles)
        self.assertIn("N3", titles)

    def test_read_notification(self):
        self.client.force_authenticate(user=self.user1)
        self.assertFalse(self.n1.is_read)
        
        res = self.client.post(reverse("notification-read", args=[self.n1.id]))
        self.assertEqual(res.status_code, 200)
        
        self.n1.refresh_from_db()
        self.assertTrue(self.n1.is_read)

    def test_read_notification_other_user(self):
        self.client.force_authenticate(user=self.user2)
        res = self.client.post(reverse("notification-read", args=[self.n1.id]))
        self.assertEqual(res.status_code, 404)

    def test_read_all_notifications(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.post(reverse("notification-read-all"))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["updated_count"], 2) # n1 and n3 were unread
        
        self.n1.refresh_from_db()
        self.n3.refresh_from_db()
        self.assertTrue(self.n1.is_read)
        self.assertTrue(self.n3.is_read)

    def test_read_all_notifications_filtered(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.post(reverse("notification-read-all"), {"shop_id": str(self.shop1.id)}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["updated_count"], 1) # only n3 was unread for shop1
        
        self.n3.refresh_from_db()
        self.n1.refresh_from_db()
        self.assertTrue(self.n3.is_read)
        self.assertFalse(self.n1.is_read)
