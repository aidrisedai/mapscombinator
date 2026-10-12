-- Program contact address for replies and the "Questions?" line in emails.
-- Only fills empty values or replaces the owner's personal address; any other
-- address set deliberately in Settings is kept.
update organizations set support_email = 'mapscombinator@gmail.com'
  where support_email is null or support_email = 'abdulazeezidris28@gmail.com';
update organizations set reply_to_email = 'mapscombinator@gmail.com'
  where reply_to_email is null or reply_to_email = 'abdulazeezidris28@gmail.com';
update cohorts set support_email = 'mapscombinator@gmail.com'
  where support_email = 'abdulazeezidris28@gmail.com';
